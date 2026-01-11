import { Search, Ship, Package, Clock } from 'lucide-react';
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

interface Cargo {
  id: string;
  referenceNumber: string;
  origin: string;
  destination: string;
  status: 'in-transit' | 'customs' | 'delivered' | 'pending';
  vessel: string;
  eta: string;
  lastUpdate: string;
}

interface CargoListProps {
  onSelectCargo: (cargoId: string) => void;
}

const cargos: Cargo[] = [
  {
    id: '1',
    referenceNumber: 'CMS-2024-001847',
    origin: 'Shanghai, CN',
    destination: 'Rotterdam, NL',
    status: 'in-transit',
    vessel: 'MSC GÜLSÜN',
    eta: '2025-01-15',
    lastUpdate: '2024-12-26 14:30 UTC',
  },
  {
    id: '2',
    referenceNumber: 'CMS-2024-001823',
    origin: 'Singapore, SG',
    destination: 'Los Angeles, US',
    status: 'customs',
    vessel: 'EVER GIVEN',
    eta: '2025-01-08',
    lastUpdate: '2024-12-26 12:15 UTC',
  },
  {
    id: '3',
    referenceNumber: 'CMS-2024-001791',
    origin: 'Hamburg, DE',
    destination: 'New York, US',
    status: 'delivered',
    vessel: 'HMM ALGECIRAS',
    eta: '2024-12-20',
    lastUpdate: '2024-12-20 09:45 UTC',
  },
  {
    id: '4',
    referenceNumber: 'CMS-2024-001856',
    origin: 'Busan, KR',
    destination: 'Felixstowe, UK',
    status: 'pending',
    vessel: 'CMA CGM ANTOINE DE SAINT EXUPERY',
    eta: '2025-01-22',
    lastUpdate: '2024-12-26 08:00 UTC',
  },
  {
    id: '5',
    referenceNumber: 'CMS-2024-001802',
    origin: 'Hong Kong, HK',
    destination: 'Antwerp, BE',
    status: 'in-transit',
    vessel: 'OOCL HONG KONG',
    eta: '2025-01-12',
    lastUpdate: '2024-12-26 16:20 UTC',
  },
];

const statusConfig = {
  'in-transit': { label: 'In Transit', color: 'bg-[#0ea5e9] text-white' },
  customs: { label: 'Customs', color: 'bg-[#f59e0b] text-white' },
  delivered: { label: 'Delivered', color: 'bg-[#10b981] text-white' },
  pending: { label: 'Pending', color: 'bg-[#64748b] text-white' },
};

export function CargoList({ onSelectCargo }: CargoListProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-[#0a1628] border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ship className="size-6 text-white" />
            <h1 className="text-white">Cargo Management System</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#94a3b8]">Operations Portal</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-[#0a1628] mb-1">Active Shipments</h2>
          <p className="text-[#64748b]">Track and manage cargo shipments</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748b]" />
            <Input
              type="search"
              placeholder="Search by reference number, vessel, or port..."
              className="pl-10 bg-white border-[#e2e8f0]"
            />
          </div>
        </div>

        {/* Table */}
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
              {cargos.map((cargo) => (
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
                      {cargo.origin} → {cargo.destination}
                    </div>
                  </TableCell>
                  <TableCell className="text-[#0a1628]">{cargo.vessel}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${statusConfig[cargo.status].color} rounded-sm px-2 py-1`}
                    >
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
            </TableBody>
          </Table>
        </div>

        {/* Footer Info */}
        <div className="mt-4 text-[#64748b]">
          Showing {cargos.length} active shipments
        </div>
      </div>
    </div>
  );
}
