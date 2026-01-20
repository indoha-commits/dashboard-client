import { Search, Ship, Package, Clock, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { getClientShipments, type ClientShipmentRow } from '../api/client';

type CargoStatus = 'COMPLETE' | 'CLIENT_ACTION_REQUIRED' | 'OPS_ACTION_REQUIRED' | 'IN_PROGRESS' | 'UNKNOWN';

type CargoRow = {
  id: string;
  referenceNumber: string;
  origin: string | null;
  destination: string | null;
  vessel: string | null;
  eta: string;
  lastUpdate: string;
  nextRequiredAction: string;
  status: CargoStatus;
};

interface CargoListProps {
  onSelectCargo: (cargoId: string) => void;
  onLogout: () => void;
}

const mockCargos: CargoRow[] = [
  {
    id: 'MSCU1234567',
    referenceNumber: 'MSCU1234567',
    origin: null,
    destination: null,
    vessel: null,
    eta: '2025-01-15',
    lastUpdate: '2024-12-26 14:30 UTC',
    nextRequiredAction: 'CLIENT_UPLOAD_REQUIRED_DOCUMENTS',
    status: 'CLIENT_ACTION_REQUIRED',
  },
];

const statusConfig: Record<CargoStatus, { label: string; color: string }> = {
  COMPLETE: { label: 'Complete', color: 'bg-[#10b981] text-white' },
  CLIENT_ACTION_REQUIRED: { label: 'Client Action', color: 'bg-[#0ea5e9] text-white' },
  OPS_ACTION_REQUIRED: { label: 'Ops Action', color: 'bg-[#f59e0b] text-white' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-[#64748b] text-white' },
  UNKNOWN: { label: 'Unknown', color: 'bg-[#64748b] text-white' },
};

function deriveStatusFromNextAction(nextRequiredAction: string): CargoStatus {
  if (nextRequiredAction === 'COMPLETE') return 'COMPLETE';
  if (nextRequiredAction.startsWith('CLIENT_')) return 'CLIENT_ACTION_REQUIRED';
  if (nextRequiredAction.startsWith('OPS_')) return 'OPS_ACTION_REQUIRED';
  if (nextRequiredAction) return 'IN_PROGRESS';
  return 'UNKNOWN';
}

function mapShipmentToRow(s: ClientShipmentRow): CargoRow {
  const lastUpdate = s.latest_event_time ?? s.created_at;
  return {
    id: s.cargo_id,
    referenceNumber: s.cargo_id,
    origin: s.origin,
    destination: s.destination,
    vessel: s.vessel,
    eta: s.eta,
    lastUpdate,
    nextRequiredAction: s.next_required_action,
    status: deriveStatusFromNextAction(s.next_required_action),
  };
}

export function CargoList({ onSelectCargo, onLogout }: CargoListProps) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CargoRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    getClientShipments()
      .then((res) => {
        if (cancelled) return;
        setRows(res.shipments.map(mapShipmentToRow));
      })
      .catch((e) => {
        if (cancelled) return;
        // In dev/preview, workers might be disabled. Don't silently show a single mock record,
        // because it looks like "only one shipment exists".
        setLoadError(e instanceof Error ? e.message : String(e));
        setRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.referenceNumber.toLowerCase().includes(q) ||
        (r.vessel ?? '').toLowerCase().includes(q) ||
        (r.origin ?? '').toLowerCase().includes(q) ||
        (r.destination ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-[#0a1628] border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/galaxy-logistics-logo.png"
              alt="Galaxy Logistics"
              className="h-16 w-auto"
            />
            <h1 className="text-white">Cargo Management System</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#94a3b8]">Client Portal</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-white hover:bg-[#1e293b] transition-colors rounded-sm"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-[#0a1628] mb-1">Active Shipments</h2>
          <p className="text-[#64748b]">Track and manage cargo shipments</p>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748b]" />
            <Input
              type="search"
              placeholder="Search by reference number..."
              className="pl-10 bg-white border-[#e2e8f0]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#e2e8f0] hover:bg-transparent">
                <TableHead className="text-[#0a1628]">Reference</TableHead>
                <TableHead className="text-[#0a1628]">Route</TableHead>
                <TableHead className="text-[#0a1628]">Vessel</TableHead>
                <TableHead className="text-[#0a1628]">Status</TableHead>
                <TableHead className="text-[#0a1628]">ETA</TableHead>
                <TableHead className="text-[#0a1628]">Last Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cargo) => (
                <TableRow
                  key={cargo.id}
                  onClick={() => onSelectCargo(cargo.id)}
                  className="border-b border-[#e2e8f0] cursor-pointer hover:bg-[#f8fafc]"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-[#64748b]" />
                      <span className="text-[#0a1628]">{cargo.referenceNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[#0a1628]">
                      {(cargo.origin ?? 'Mombasa, KN')} → {(cargo.destination ?? 'Kigali, RW')}
                    </div>
                  </TableCell>
                  <TableCell className="text-[#0a1628]">{cargo.vessel ?? 'MSC'}</TableCell>
                  <TableCell>
                    <Badge className={`${statusConfig[cargo.status].color} rounded-sm px-2 py-1`}>
                      {statusConfig[cargo.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#0a1628]">{cargo.eta}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[#64748b]">
                      <Clock className="size-4" />
                      <span>{cargo.lastUpdate}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center text-[#64748b]">
                    {loadError ? (
                      <div>
                        <div className="text-[#0a1628] mb-1">Could not load shipments</div>
                        <div className="text-sm">{loadError}</div>
                      </div>
                    ) : (
                      <div>No active shipments found.</div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-[#64748b]">Showing {filtered.length} shipments</div>
      </div>
    </div>
  );
}
