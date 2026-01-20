import { getAccessToken } from '../auth/supabase';

// When deploying via Cloudflare Worker API, calls should always go to VITE_API_BASE_URL.
// Keep this env for optional local preview toggles, but default to enabled.
const workersEnabled = import.meta.env.VITE_WORKERS_ENABLED !== 'false';

function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set');
  }
  return baseUrl;
}

function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  if (!token) {
    return {};
  }
  return { authorization: `Bearer ${token}` };
}

export type InsertClientDocumentInput = {
  cargoId: string;
  documentType: string;
  // For private storage, this should be the storage object path returned by the worker signed upload.
  driveUrl: string;
};

export async function insertClientDocument(input: InsertClientDocumentInput): Promise<{ id: string }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/documents`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      cargo_id: input.cargoId,
      document_type: input.documentType,
      drive_url: input.driveUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`insertClientDocument failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  if (!data?.id) {
    throw new Error('insertClientDocument: missing id');
  }
  return { id: data.id };
}

export type ClientShipmentRow = {
  cargo_id: string;

  route: string | null;
  vessel: string | null;
  origin: string | null;
  destination: string | null;

  expected_arrival_date: string;
  eta: string;

  latest_event: string | null;
  latest_event_time: string | null;
  next_required_action: string;

  documents: {
    total_required: number;
    total_submitted: number;
    total_verified: number;
    all_submitted: boolean;
    all_verified: boolean;
  };

  created_at: string;
};

export async function getClientShipments(): Promise<{ shipments: ClientShipmentRow[] }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/shipments`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getClientShipments failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { shipments: ClientShipmentRow[] };
  return { shipments: data?.shipments ?? [] };
}

export type ClientCargoDetail = {
  cargo: {
    cargo_id: string;
    client_id: string;
    container_count: number;
    expected_arrival_date: string;
    eta: string;
    created_at: string;
  };
  projection: {
    next_required_action: string;
    latest_event: string | null;
    latest_event_time: string | null;
    documents: {
      total_required: number;
      total_submitted: number;
      total_verified: number;
      all_submitted: boolean;
      all_verified: boolean;
    };
  };
  documents: Array<{
    id: string;
    document_type: string;
    status: string;
    drive_url: string | null;
    uploaded_at: string | null;
    verified_at: string | null;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    event_time: string;
    actor_type: string;
    actor_id: string | null;
    location_id: string | null;
    recorded_at: string;
  }>;
};

export async function getClientCargoDetail(cargoId: string): Promise<ClientCargoDetail> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/cargo/${encodeURIComponent(cargoId)}`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getClientCargoDetail failed: ${res.status} ${text}`);
  }

  return (await res.json()) as ClientCargoDetail;
}

export type CargoApproval = {
  id: string;
  cargo_id: string;
  kind: 'DECLARATION_DRAFT' | 'ASSESSMENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  // While pending, this is typically a Supabase Storage URL.
  // After client approval, the worker migrates the file to Google Drive and replaces this with a Drive URL.
  file_url: string | null;
  // Optional storage path (usually cleared after migration)
  file_path?: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
  decided_at: string | null;
  decided_by: string | null;
  rejection_reason: string | null;
};

export async function getClientCargoApprovals(cargoId: string): Promise<{ approvals: CargoApproval[] }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/cargo/${encodeURIComponent(cargoId)}/approvals`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getClientCargoApprovals failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { approvals: CargoApproval[] };
  return { approvals: data?.approvals ?? [] };
}

export async function getClientApprovalSignedUrl(approvalId: string): Promise<{ url: string; kind: 'storage' | 'drive' }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/approvals/${encodeURIComponent(approvalId)}/signed-url`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getClientApprovalSignedUrl failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { url: string; kind: 'storage' | 'drive' };
}

export async function getClientDocumentSignedUrl(documentId: string): Promise<{ url: string; kind: 'storage' | 'drive' }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/documents/${encodeURIComponent(documentId)}/signed-url`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getClientDocumentSignedUrl failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { url: string; kind: 'storage' | 'drive' };
}

export async function createClientDocumentUploadUrl(input: {
  cargoId: string;
  documentType: string;
  fileName: string;
}): Promise<{ path: string; signed_url: string; expires_in: number }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/cargo/${encodeURIComponent(input.cargoId)}/upload-url`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ document_type: input.documentType, file_name: input.fileName }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`createClientDocumentUploadUrl failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { path: string; signed_url: string; expires_in: number };
}

export async function approveClientCargoApproval(approvalId: string): Promise<{ approval: CargoApproval }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/approvals/${encodeURIComponent(approvalId)}/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`approveClientCargoApproval failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { approval: CargoApproval };
}

export async function rejectClientCargoApproval(approvalId: string, rejectionReason: string): Promise<{ approval: CargoApproval }> {
  if (!workersEnabled) {
    throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');
  }

  const res = await fetch(`${getBaseUrl()}/client/approvals/${encodeURIComponent(approvalId)}/reject`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ rejection_reason: rejectionReason }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`rejectClientCargoApproval failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { approval: CargoApproval };
}
