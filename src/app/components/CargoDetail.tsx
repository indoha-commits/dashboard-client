import {
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Download,
  FileText,
  Ship,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  approveClientCargoApproval,
  getClientApprovalSignedUrl,
  getClientCargoApprovals,
  getClientCargoDetail,
  getClientDocumentSignedUrl,
  rejectClientCargoApproval,
  type CargoApproval,
  insertClientDocument,
  type ClientCargoDetail,
} from '../api/client';
import { uploadClientDocumentFile } from '../auth/storage';

interface CargoDetailProps {
  cargoId: string;
  onBack: () => void;
}

type UiDocument = {
  id: string;
  name: string;
  type: string;
  status: 'uploaded' | 'pending' | 'verified';
  uploadedDate?: string;
  driveUrl?: string;
};

type UiTimelineEvent = {
  date: string;
  time: string;
  status: string;
  location: string;
  completed: boolean;
  detail?: string;
};

type NextRequiredActionInfo = {
  title: string;
  subtitle?: string;
  raw: string;
};

const mockTimelineEvents: UiTimelineEvent[] = [
  {
    date: '2024-12-25',
    time: '09:00 UTC',
    status: 'Container Received at Port',
    location: 'Port of Mombasa',
    completed: true,
  },
  {
    date: '2024-12-26',
    time: '14:30 UTC',
    status: 'Customs Declaration Submitted',
    location: 'Kenya Revenue Authority',
    completed: true,
  },
  {
    date: '2024-12-27',
    time: '10:15 UTC',
    status: 'Awaiting Document Verification',
    location: 'Galaxy Logistics',
    completed: false,
  },
];

const mockDocuments: UiDocument[] = [
  {
    id: '1',
    name: 'Bill of Lading',
    type: 'BILL_OF_LADING',
    status: 'verified',
    uploadedDate: '2024-12-20',
  },
  {
    id: '2',
    name: 'Commercial Invoice',
    type: 'COMMERCIAL_INVOICE',
    status: 'uploaded',
    uploadedDate: '2024-12-22',
  },
  {
    id: '3',
    name: 'Packing List',
    type: 'PACKING_LIST',
    status: 'pending',
  },
];

function mapDocStatus(status: string): UiDocument['status'] {
  if (status === 'VERIFIED') return 'verified';
  if (status === 'UPLOADED') return 'uploaded';
  return 'pending';
}

function docDisplayName(documentType: string): string {
  switch (documentType) {
    case 'BILL_OF_LADING':
      return 'Bill of Lading';
    case 'COMMERCIAL_INVOICE':
      return 'Commercial Invoice';
    case 'PACKING_LIST':
      return 'Packing List';
    case 'IMPORT_PERMIT':
      return 'Import Permit';
    case 'IMPORT_LICENSE':
      return 'Import License';
    case 'TYPE_APPROVAL':
      return 'Type Approval';
    default:
      return documentType;
  }
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

function formatIso(ts: string | null | undefined): { date: string; time: string } {
  if (!ts) return { date: '—', time: '—' };
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return { date: ts, time: '' };
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16) + ' UTC';
  return { date, time };
}

function mapEventsToTimeline(events: ClientCargoDetail['events']): UiTimelineEvent[] {
  if (!events?.length) return [];
  return events
    .slice()
    .sort((a, b) => {
      const at = Date.parse(a.event_time);
      const bt = Date.parse(b.event_time);
      if (at !== bt) return at - bt;
      return Date.parse(a.recorded_at) - Date.parse(b.recorded_at);
    })
    .map((e) => {
      const { date, time } = formatIso(e.event_time);
      return {
        date,
        time,
        status: formatLabel(e.event_type),
        location: e.location_id ?? '—',
        completed: true,
      };
    });
}

function buildDerivedTimeline(detail: ClientCargoDetail, approvals: CargoApproval[]): UiTimelineEvent[] {
  // This mirrors `cargo-internal-dashboard/src/app/components/pages/CargoTimelinePage.tsx`.
  const events: Array<{ label: string; at: string; detail?: string; completed: boolean }> = [];

  // 1) Cargo created
  events.push({
    label: 'Cargo created',
    at: detail.cargo.created_at,
    completed: true,
  });

  // 2) Document-based milestones (bucket evidence)
  const uploadedDocs = detail.documents.filter((d) => d.status === 'UPLOADED' && d.uploaded_at);
  const verifiedDocs = detail.documents.filter((d) => d.status === 'VERIFIED' && d.verified_at);

  const earliestUpload = uploadedDocs
    .map((d) => d.uploaded_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];

  const latestUpload = uploadedDocs
    .map((d) => d.uploaded_at as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  const latestVerified = verifiedDocs
    .map((d) => d.verified_at as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  if (earliestUpload) {
    events.push({
      label: 'Documents uploaded',
      at: earliestUpload,
      detail: 'Files detected in bucket (pre-validation).',
      completed: true,
    });
  }

  // 3) Validation step (explicit when we see bucket uploads without verification)
  const hasUploaded = detail.documents.some((d) => d.status === 'UPLOADED');
  const hasAnyVerified = detail.documents.some((d) => d.status === 'VERIFIED');
  const hasPendingValidation = hasUploaded && !hasAnyVerified;

  if (hasPendingValidation) {
    events.push({
      label: 'Validation in progress',
      at: latestUpload ?? earliestUpload ?? detail.cargo.created_at,
      detail: 'Documents are present in the bucket and awaiting verification.',
      completed: false,
    });
  }

  if (latestVerified) {
    events.push({
      label: 'Documents verified',
      at: latestVerified,
      completed: true,
    });
  }

  // 4) Approvals (draft/assessment) visibility
  for (const a of approvals) {
    events.push({
      label: `${formatLabel(a.kind)} ${formatLabel(a.status)}`,
      at: a.decided_at ?? a.created_at,
      detail: a.decided_at ? `Decided ${new Date(a.decided_at).toLocaleString()}` : 'Awaiting decision',
      completed: a.status !== 'PENDING',
    });
  }

  // Sort chronologically
  return events
    .filter((e) => !Number.isNaN(Date.parse(e.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((ev) => {
      const t = formatIso(ev.at);
      return {
        date: t.date,
        time: t.time,
        status: ev.label,
        location: '—',
        completed: ev.completed,
        detail: ev.detail,
      };
    });
}

function formatFriendlyDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function maxIso(...values: Array<string | null | undefined>): string | null {
  const best = values
    .filter((v): v is string => Boolean(v))
    .map((v) => ({ raw: v, t: Date.parse(v) }))
    .filter((v) => !Number.isNaN(v.t))
    .sort((a, b) => b.t - a.t)[0];
  return best?.raw ?? null;
}

function getNextRequiredActionInfo(rawAction: string): NextRequiredActionInfo {
  // UI-only mapping: keep raw enum available, but present client-friendly wording.
  switch (rawAction) {
    case 'OPS_INSERT_PORT_OFFLOADED':
      return {
        title: 'Waiting for Port Offloading Confirmation',
        subtitle: '(Ops)',
        raw: rawAction,
      };
    case 'CLIENT_UPLOAD_REQUIRED_DOCUMENTS':
      return {
        title: 'Waiting for Required Documents',
        subtitle: '(You)',
        raw: rawAction,
      };
    case 'COMPLETE':
      return {
        title: 'No action required',
        raw: rawAction,
      };
    default:
      // Soft fallback: make enums readable without exposing raw as the primary label.
      return {
        title: rawAction
          .replace(/^CLIENT_/, '')
          .replace(/^OPS_/, '')
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase()),
        raw: rawAction,
      };
  }
}

function computeSlaHint(eta: string | null | undefined): { label: string; tone: 'ok' | 'risk' } | null {
  if (!eta) return null;
  const etaTime = Date.parse(eta);
  if (Number.isNaN(etaTime)) return null;

  const msRemaining = etaTime - Date.now();
  const abs = Math.abs(msRemaining);
  const hours = Math.round(abs / (1000 * 60 * 60));
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));

  const remainingText = msRemaining >= 0 ? 'remaining' : 'overdue';
  const timeText = days >= 2 ? `${days} days ${remainingText}` : `${hours} hours ${remainingText}`;

  // Enterprise-safe heuristic: < 24h is "At Risk".
  const atRisk = msRemaining >= 0 && msRemaining <= 24 * 60 * 60 * 1000;
  return {
    label: `SLA: ${atRisk ? 'At Risk' : 'On Track'} (${timeText})`,
    tone: atRisk ? 'risk' : 'ok',
  };
}

export function CargoDetail({ cargoId, onBack }: CargoDetailProps) {
  const workersEnabled = import.meta.env.VITE_WORKERS_ENABLED === 'true';

  const [detail, setDetail] = useState<ClientCargoDetail | null>(null);
  const [approvals, setApprovals] = useState<CargoApproval[]>([]);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [approvalsBusyId, setApprovalsBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!workersEnabled) {
      setDetail(null);
      return;
    }

    setLoading(true);
    Promise.all([getClientCargoDetail(cargoId), getClientCargoApprovals(cargoId)])
      .then(([d, approvalsRes]) => {
        if (cancelled) return;
        setDetail(d);
        setApprovals(approvalsRes.approvals);
        setApprovalsError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setDetail(null);
        setApprovals([]);
        setApprovalsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cargoId, workersEnabled]);

  const nextRequiredAction = detail?.projection?.next_required_action ?? 'CLIENT_UPLOAD_REQUIRED_DOCUMENTS';
  const nextRequiredActionInfo = useMemo(() => getNextRequiredActionInfo(nextRequiredAction), [nextRequiredAction]);

  const documentsLastUpdated = useMemo(() => {
    if (!detail) return null;
    // Use the freshest doc activity timestamp (verified_at preferred when present).
    const values = detail.documents.flatMap((d) => [d.verified_at, d.uploaded_at]);
    return maxIso(...values);
  }, [detail]);

  const timelineLastUpdated = useMemo(() => {
    if (!detail) return null;
    const values = detail.events.flatMap((e) => [e.event_time, e.recorded_at]);
    return maxIso(...values);
  }, [detail]);

  const slaHint = useMemo(() => computeSlaHint(detail?.cargo.eta), [detail?.cargo.eta]);

  const documents: UiDocument[] = useMemo(() => {
    if (!detail) return mockDocuments;
    return detail.documents.map((d) => ({
      id: d.id,
      name: docDisplayName(d.document_type),
      type: d.document_type,
      status: mapDocStatus(d.status),
      uploadedDate: d.uploaded_at ? d.uploaded_at.slice(0, 10) : undefined,
      driveUrl: d.drive_url ?? undefined,
    }));
  }, [detail]);

  const timelineEvents: UiTimelineEvent[] = useMemo(() => {
    if (!detail) return mockTimelineEvents;
    const mapped = mapEventsToTimeline(detail.events);
    if (mapped.length) return mapped;

    // No milestone events recorded: show the same derived timeline as internal ops.
    const derived = buildDerivedTimeline(detail, approvals);
    return derived.length ? derived : mockTimelineEvents;
  }, [detail, approvals]);

  const handleApprovalApprove = async (approvalId: string) => {
    try {
      setApprovalsBusyId(approvalId);
      const res = await approveClientCargoApproval(approvalId);
      setApprovals((prev) => prev.map((a) => (a.id === approvalId ? res.approval : a)));
    } catch (e) {
      setApprovalsError(e instanceof Error ? e.message : String(e));
    } finally {
      setApprovalsBusyId(null);
    }
  };

  const handleApprovalReject = async (approvalId: string) => {
    const reason = window.prompt('Reason for rejection?');
    if (!reason) return;
    try {
      setApprovalsBusyId(approvalId);
      const res = await rejectClientCargoApproval(approvalId, reason);
      setApprovals((prev) => prev.map((a) => (a.id === approvalId ? res.approval : a)));
    } catch (e) {
      setApprovalsError(e instanceof Error ? e.message : String(e));
    } finally {
      setApprovalsBusyId(null);
    }
  };

  const handleUploadClick = (docType: string) => {
    if (!workersEnabled) {
      window.alert('Uploads are disabled in preview mode.');
      return;
    }
    setUploadError(null);
    setUploadDocType(docType);
  };

  const handleFileChosen = async (file: File) => {
    if (!uploadDocType) return;

    try {
      setIsUploading(uploadDocType);
      setUploadError(null);

      const { path } = await uploadClientDocumentFile({
        cargoId,
        documentType: uploadDocType,
        file,
      });

      // For private buckets, the backend stores the storage object path (not a public URL)
      await insertClientDocument({
        cargoId,
        documentType: uploadDocType,
        driveUrl: path,
      });

      const [refreshed, approvalsRes] = await Promise.all([
        getClientCargoDetail(cargoId),
        getClientCargoApprovals(cargoId),
      ]);
      setDetail(refreshed);
      setApprovals(approvalsRes.approvals);
      setUploadDocType(null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Hidden file input used by the upload modal */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // reset so selecting the same file twice still triggers change
          e.currentTarget.value = '';
          if (file) void handleFileChosen(file);
        }}
      />

      {uploadDocType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-sm border border-[#e2e8f0]">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="text-[#0a1628]" style={{ fontWeight: 600 }}>
                Upload {docDisplayName(uploadDocType)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUploadDocType(null)}
                className="text-[#0a1628] hover:bg-[#f8fafc]"
                disabled={isUploading === uploadDocType}
              >
                Close
              </Button>
            </div>

            <div className="p-4">
              {uploadError && (
                <div className="mb-3 rounded-sm border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#0a1628]">
                  {uploadError}
                </div>
              )}

              <div
                className="border-2 border-dashed border-[#e2e8f0] rounded-sm p-6 text-center bg-[#ffffff]"
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFileChosen(file);
                }}
              >
                <div className="text-[#0a1628] mb-2">Drag & drop a file here</div>
                <div className="text-sm text-[#64748b] mb-4">or choose a file from your computer</div>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading === uploadDocType}
                  className="bg-[#0a1628] hover:bg-[#162844] text-white disabled:opacity-60"
                >
                  Choose file
                </Button>
                {isUploading === uploadDocType && (
                  <div className="mt-3 text-sm text-[#64748b]">Uploading…</div>
                )}
              </div>

              <div className="mt-3 text-xs text-[#64748b]">
                Note: Uploads are stored in the project storage bucket and linked to this shipment.
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="bg-[#0a1628] border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:bg-[#1e293b]"
            >
              <ChevronRight className="size-4 rotate-180" />
              Back
            </Button>
            <img
              src="/galaxy-logistics-logo.png"
              alt="Galaxy Logistics"
              className="h-16 w-auto"
            />
            <h1 className="text-white">Cargo Details</h1>
          </div>
          <div className="text-[#94a3b8]">Client Portal</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#64748b] mb-2">
            <span>Active Shipments</span>
            <ArrowRight className="size-4" />
            <span className="text-[#0a1628]">{cargoId}</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[#0a1628] mb-1">Shipment Reference: {cargoId}</h2>
              <p className="text-[#64748b]">
                Route:{' '}
                {detail?.cargo.route ??
                  (detail?.cargo.origin && detail?.cargo.destination
                    ? `${detail.cargo.origin} → ${detail.cargo.destination}`
                    : 'Mombasa, KN → Kigali, RW')}
              </p>
              <p className="text-[#64748b]">
                Vessel: {detail?.cargo.vessel ?? 'MSC'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-[#64748b] flex items-center gap-1">
                <TriangleAlert className="size-3 text-[#94a3b8]" />
                <span>Next Required Action</span>
              </div>

              {loading ? (
                <Badge className="bg-[#64748b] text-white">Loading…</Badge>
              ) : (
                <Badge className="bg-[#0ea5e9] text-white">{nextRequiredActionInfo.title}</Badge>
              )}

              <div className="text-[11px] text-[#94a3b8]">
                {nextRequiredActionInfo.subtitle ? `${nextRequiredActionInfo.subtitle} · ` : ''}
                {nextRequiredActionInfo.raw}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[#0a1628]">Required Documents</h3>
                  <div className="text-xs text-[#94a3b8] mt-1">
                    Documents last updated: {formatFriendlyDate(documentsLastUpdated)}
                  </div>
                </div>
                <div className="text-sm text-[#64748b] text-right">
                  {detail
                    ? `${detail.projection.documents.total_verified}/${detail.projection.documents.total_required} verified`
                    : '—'}
                </div>
              </div>
              <div className="space-y-3">
                {detail &&
                  detail.projection.documents.total_required > 0 &&
                  detail.projection.documents.total_verified === detail.projection.documents.total_required && (
                    <div className="text-sm text-[#64748b]">
                      All required documents are verified. No action needed.
                    </div>
                  )}
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-sm"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-5 text-[#64748b]" />
                      <div>
                        <div className="text-[#0a1628]">{doc.name}</div>
                        <div className="text-sm text-[#64748b]">
                          {doc.uploadedDate ? `Uploaded ${doc.uploadedDate}` : 'Not uploaded'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.status === 'verified' && (
                        <Badge className="bg-[#10b981] text-white rounded-sm">
                          <Check className="size-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {doc.status === 'uploaded' && (
                        <Badge className="bg-[#f59e0b] text-white rounded-sm">Uploaded</Badge>
                      )}
                      {doc.status === 'pending' && (
                        <Badge className="bg-[#64748b] text-white rounded-sm">Required</Badge>
                      )}

                      {doc.status === 'pending' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#e2e8f0] text-[#0a1628] hover:bg-[#f8fafc]"
                          onClick={() => handleUploadClick(doc.type)}
                          disabled={!workersEnabled || isUploading === doc.type}
                        >
                          <Upload className="size-4 mr-2" />
                          {!workersEnabled
                            ? 'Disabled'
                            : isUploading === doc.type
                              ? 'Uploading…'
                              : 'Upload'}
                        </Button>
                      ) : doc.driveUrl ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              // Same logic as ops:
                              // - Before VERIFIED, the file is still in the bucket => use signed URL.
                              // - After VERIFIED, driveUrl is a Google Drive URL => open directly.
                              if (doc.status === 'verified') {
                                window.open(doc.driveUrl, '_blank', 'noreferrer');
                                return;
                              }

                              const { url } = await getClientDocumentSignedUrl(doc.id);
                              window.open(url, '_blank', 'noreferrer');
                            } catch (e) {
                              alert(String(e));
                            }
                          }}
                          className="inline-flex items-center text-sm text-[#64748b] hover:text-[#0a1628]"
                        >
                          <Download className="size-4 mr-2" />
                          View / Download
                        </button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#64748b] hover:text-[#0a1628]"
                          disabled
                        >
                          <Download className="size-4 mr-2" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[#0a1628]">Drafts &amp; Assessments</h3>
                  <div className="text-sm text-[#64748b]">Review internal drafts and assessments and approve for taxes/clearance.</div>
                </div>
                <div className="text-sm text-[#64748b]">{approvals.length} items</div>
              </div>

              {approvalsError && (
                <div className="mb-3 rounded-sm border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#0a1628]">
                  {approvalsError}
                </div>
              )}

              <div className="space-y-3">
                {approvals.length === 0 ? (
                  <div className="text-sm text-[#64748b]">No drafts or assessments have been shared yet.</div>
                ) : (
                  approvals.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-sm">
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 text-[#64748b]" />
                        <div>
                          <div className="text-[#0a1628]">{a.kind === 'DECLARATION_DRAFT' ? 'Declaration Draft' : 'Assessment'}</div>
                          <div className="text-sm text-[#64748b]">Shared {a.created_at?.slice(0, 10)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {a.status === 'APPROVED' && <Badge className="bg-[#10b981] text-white rounded-sm">Approved</Badge>}
                        {a.status === 'REJECTED' && <Badge className="bg-[#ef4444] text-white rounded-sm">Rejected</Badge>}
                        {a.status === 'PENDING' && <Badge className="bg-[#f59e0b] text-white rounded-sm">Pending</Badge>}

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { url } = await getClientApprovalSignedUrl(a.id);
                              window.open(url, '_blank', 'noreferrer');
                            } catch (e) {
                              alert(String(e));
                            }
                          }}
                          className="inline-flex items-center text-sm text-[#64748b] hover:text-[#0a1628] disabled:opacity-50"
                          disabled={!a.file_url && !a.file_path}
                        >
                          <Download className="size-4 mr-2" />
                          Download
                        </button>

                        {a.status === 'PENDING' && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#e2e8f0] text-[#0a1628] hover:bg-[#f8fafc]"
                              onClick={() => handleApprovalReject(a.id)}
                              disabled={approvalsBusyId === a.id}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[#0a1628] hover:bg-[#162844] text-white"
                              onClick={() => handleApprovalApprove(a.id)}
                              disabled={approvalsBusyId === a.id}
                            >
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[#0a1628]">Shipment Timeline</h3>
                  <div className="text-xs text-[#94a3b8] mt-1">
                    Timeline last updated: {formatFriendlyDate(timelineLastUpdated)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#64748b] hover:text-[#0a1628] hover:bg-[#f8fafc]"
                  onClick={() => setTimelineExpanded((v) => !v)}
                >
                  {timelineExpanded ? 'Collapse' : 'Expand Timeline'}
                </Button>
              </div>
              {timelineExpanded && (
                <div className="space-y-4">
                  {timelineEvents.map((event, index, arr) => (
                    <div key={index} className="relative">
                      {index < arr.length - 1 && (
                        <div
                          className={`absolute left-[11px] top-6 w-px h-full ${event.completed ? 'bg-[#10b981]' : 'bg-[#e2e8f0]'}`}
                        />
                      )}
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          {event.completed ? (
                            <div className="size-6 rounded-full bg-[#10b981] flex items-center justify-center">
                              <Check className="size-4 text-white" />
                            </div>
                          ) : (
                            <div className="size-6 rounded-full border-2 border-[#e2e8f0] flex items-center justify-center">
                              <Circle className="size-2 text-[#64748b] fill-current" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-[#0a1628]">{event.status}</div>
                            <div className="text-sm text-[#64748b] flex items-center gap-1">
                              <Clock className="size-3" />
                              {event.date} {event.time}
                            </div>
                          </div>
                          <div className="text-sm text-[#64748b]">{event.location}</div>
                          {event.detail && <div className="text-xs text-[#94a3b8] mt-1">{event.detail}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[#0a1628]">Action Required</h3>
                  <div className="text-xs text-[#94a3b8] mt-1">Next Required Action</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-[#fef3c7] border border-[#f59e0b] rounded-sm">
                <TriangleAlert className="size-5 text-[#f59e0b] mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[#0a1628]" style={{ fontWeight: 600 }}>
                    {nextRequiredActionInfo.title}{' '}
                    {nextRequiredActionInfo.subtitle ? (
                      <span className="text-[#64748b]" style={{ fontWeight: 500 }}>
                        {nextRequiredActionInfo.subtitle}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[#94a3b8] mt-1">{nextRequiredActionInfo.raw}</div>
                  <div className="text-sm text-[#64748b] mt-2">
                    {workersEnabled
                      ? 'Derived from facts (documents + events).'
                      : 'Preview mode (mock).'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <h3 className="text-[#0a1628] mb-4">Notifications</h3>
              <div className="space-y-3">
                <div className="p-4 border border-[#e2e8f0] rounded-sm">
                  <div className="text-[#0a1628] mb-1">Next required action</div>
                  <div className="text-sm text-[#64748b]">
                    {nextRequiredActionInfo.title}{' '}
                    {nextRequiredActionInfo.subtitle ? nextRequiredActionInfo.subtitle : ''}
                  </div>
                  <div className="text-xs text-[#94a3b8] mt-1">{nextRequiredActionInfo.raw}</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <h3 className="text-[#0a1628] mb-4">Shipment Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Container Count</span>
                  <span className="text-[#0a1628]">{detail?.cargo.container_count ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Arrival Date</span>
                  <span className="text-[#0a1628]">{detail?.cargo.expected_arrival_date ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">ETA</span>
                  <span className="text-[#0a1628]">{detail?.cargo.eta ?? '—'}</span>
                </div>
                {slaHint && (
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">SLA</span>
                    <span className={slaHint.tone === 'risk' ? 'text-[#b45309]' : 'text-[#0a1628]'}>
                      {slaHint.label.replace(/^SLA:\s*/, '')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
