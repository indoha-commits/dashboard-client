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
};

type UiTimelineEvent = {
  date: string;
  time: string;
  status: string;
  location: string;
  completed: boolean;
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
        status: e.event_type,
        location: e.location_id ?? '—',
        completed: true,
      };
    });
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
    return mapped.length ? mapped : [];
  }, [detail]);

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
            <div className="flex items-center gap-3">
              {loading ? (
                <Badge className="bg-[#64748b] text-white">Loading…</Badge>
              ) : (
                <Badge className="bg-[#0ea5e9] text-white">{nextRequiredAction}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0a1628]">Required Documents</h3>
                <div className="text-sm text-[#64748b]">
                  {detail
                    ? `${detail.projection.documents.total_verified}/${detail.projection.documents.total_required} verified`
                    : '—'}
                </div>
              </div>
              <div className="space-y-3">
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
                              const { url } = await getClientDocumentSignedUrl(doc.id);
                              window.open(url, '_blank', 'noreferrer');
                            } catch (e) {
                              alert(String(e));
                            }
                          }}
                          className="inline-flex items-center text-sm text-[#64748b] hover:text-[#0a1628]"
                        >
                          <Download className="size-4 mr-2" />
                          Download
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
              <h3 className="text-[#0a1628] mb-4">Shipment Timeline</h3>
              <div className="space-y-4">
                {(timelineEvents.length ? timelineEvents : mockTimelineEvents).map((event, index, arr) => (
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <h3 className="text-[#0a1628] mb-4">Action Required</h3>
              <div className="flex items-start gap-3 p-4 bg-[#fef3c7] border border-[#f59e0b] rounded-sm">
                <TriangleAlert className="size-5 text-[#f59e0b] mt-0.5" />
                <div>
                  <div className="text-[#0a1628] mb-1">{nextRequiredAction}</div>
                  <div className="text-sm text-[#64748b]">
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
                  <div className="text-sm text-[#64748b]">{nextRequiredAction}</div>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
