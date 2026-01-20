import { getAccessToken } from '../auth/supabase';

const workersEnabled = import.meta.env.VITE_WORKERS_ENABLED !== 'false';

function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) throw new Error('VITE_API_BASE_URL is not set');
  return baseUrl;
}

function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export type CargoApprovalKind = 'DECLARATION_DRAFT' | 'ASSESSMENT';
export type CargoApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type CargoApproval = {
  id: string;
  cargo_id: string;
  kind: CargoApprovalKind;
  status: CargoApprovalStatus;
  file_url: string;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
  rejection_reason: string | null;
};

export async function getCargoApprovals(cargoId: string): Promise<{ approvals: CargoApproval[] }> {
  if (!workersEnabled) throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');

  const res = await fetch(`${getBaseUrl()}/client/cargo/${encodeURIComponent(cargoId)}/approvals`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getCargoApprovals failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { approvals: CargoApproval[] };
  return { approvals: data?.approvals ?? [] };
}

export async function approveCargoApproval(approvalId: string): Promise<{ approval: CargoApproval }> {
  if (!workersEnabled) throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');

  const res = await fetch(`${getBaseUrl()}/client/approvals/${encodeURIComponent(approvalId)}/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`approveCargoApproval failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { approval: CargoApproval };
  return { approval: data.approval };
}

export async function rejectCargoApproval(approvalId: string, rejectionReason: string): Promise<{ approval: CargoApproval }> {
  if (!workersEnabled) throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');

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
    throw new Error(`rejectCargoApproval failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { approval: CargoApproval };
  return { approval: data.approval };
}
