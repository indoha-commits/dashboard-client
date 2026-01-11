import { ArrowRight, Ship, Clock, Check, Circle, FileText, Upload, Download, TriangleAlert, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface CargoDetailProps {
  cargoId: string;
  onBack: () => void;
}

interface TimelineEvent {
  date: string;
  time: string;
  status: string;
  location: string;
  completed: boolean;
}

interface Document {
  id: string;
  name: string;
  type: string;
  status: 'uploaded' | 'pending' | 'verified';
  uploadedDate?: string;
}

const timelineEvents: TimelineEvent[] = [
  {
    date: '2024-12-10',
    time: '08:30 UTC',
    status: 'Cargo Loaded',
    location: 'Shanghai Port, CN',
    completed: true,
  },
  {
    date: '2024-12-10',
    time: '14:00 UTC',
    status: 'Departed Port',
    location: 'Shanghai, CN',
    completed: true,
  },
  {
    date: '2024-12-18',
    time: '11:45 UTC',
    status: 'In Transit',
    location: 'Indian Ocean',
    completed: true,
  },
  {
    date: '2024-12-26',
    time: '14:30 UTC',
    status: 'En Route',
    location: 'Mediterranean Sea',
    completed: true,
  },
  {
    date: '2025-01-12',
    time: 'EST',
    status: 'Expected Arrival',
    location: 'Rotterdam Port, NL',
    completed: false,
  },
  {
    date: '2025-01-15',
    time: 'EST',
    status: 'Customs Clearance',
    location: 'Rotterdam, NL',
    completed: false,
  },
];

const documents: Document[] = [
  {
    id: '1',
    name: 'Bill of Lading',
    type: 'BOL',
    status: 'verified',
    uploadedDate: '2024-12-09',
  },
  {
    id: '2',
    name: 'Commercial Invoice',
    type: 'INV',
    status: 'verified',
    uploadedDate: '2024-12-09',
  },
  {
    id: '3',
    name: 'Packing List',
    type: 'PKL',
    status: 'uploaded',
    uploadedDate: '2024-12-09',
  },
  {
    id: '4',
    name: 'Certificate of Origin',
    type: 'COO',
    status: 'pending',
  },
  {
    id: '5',
    name: 'Import License',
    type: 'IMP',
    status: 'pending',
  },
];

const alerts = [
  {
    id: '1',
    type: 'warning',
    message: 'Storage fees will apply if cargo is not collected within 5 days of arrival',
    date: '2024-12-26',
  },
  {
    id: '2',
    type: 'critical',
    message: 'Certificate of Origin required before arrival - submit within 10 days',
    date: '2024-12-26',
  },
];

export function CargoDetail({ cargoId, onBack }: CargoDetailProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-[#0a1628] border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Button
              onClick={onBack}
              variant="ghost"
              className="text-[#94a3b8] hover:text-white hover:bg-[#1e293b] px-3"
            >
              <ArrowRight className="size-4 rotate-180" />
            </Button>
            <div className="flex items-center gap-3">
              <Ship className="size-6 text-white" />
              <h1 className="text-white">CMS-2024-001847</h1>
            </div>
          </div>
          <div className="ml-14 flex items-center gap-6 text-[#94a3b8]">
            <span>MSC GÜLSÜN</span>
            <span>•</span>
            <span>Shanghai, CN → Rotterdam, NL</span>
            <span>•</span>
            <Badge className="bg-[#0ea5e9] text-white rounded-sm">In Transit</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Timeline */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-6">
              <h3 className="text-[#0a1628] mb-6">Shipment Timeline</h3>
              <div className="space-y-6">
                {timelineEvents.map((event, index) => (
                  <div key={index} className="relative">
                    {index < timelineEvents.length - 1 && (
                      <div
                        className={`absolute left-[11px] top-[28px] w-[2px] h-[calc(100%+12px)] ${
                          event.completed ? 'bg-[#10b981]' : 'bg-[#e2e8f0]'
                        }`}
                      />
                    )}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {event.completed ? (
                          <div className="size-6 rounded-full bg-[#10b981] flex items-center justify-center">
                            <Check className="size-4 text-white" />
                          </div>
                        ) : (
                          <div className="size-6 rounded-full border-2 border-[#e2e8f0] bg-white flex items-center justify-center">
                            <Circle className="size-3 text-[#cbd5e1]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={event.completed ? 'text-[#0a1628]' : 'text-[#94a3b8]'}>
                          {event.status}
                        </div>
                        <div className="text-[#64748b] mt-1">{event.location}</div>
                        <div className="flex items-center gap-2 text-[#94a3b8] mt-1">
                          <Clock className="size-3" />
                          <span>{event.date} {event.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Documents & Alerts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Alerts */}
            <div className="bg-white border border-[#e2e8f0] rounded-sm">
              <div className="border-b border-[#e2e8f0] px-6 py-4">
                <h3 className="text-[#0a1628]">Alerts & Notifications</h3>
              </div>
              <div className="p-6 space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex gap-4 p-4 rounded-sm border ${
                      alert.type === 'critical'
                        ? 'bg-[#fef2f2] border-[#fecaca]'
                        : 'bg-[#fffbeb] border-[#fde68a]'
                    }`}
                  >
                    <TriangleAlert
                      className={`size-5 flex-shrink-0 mt-0.5 ${
                        alert.type === 'critical' ? 'text-[#dc2626]' : 'text-[#f59e0b]'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-[#0a1628]">{alert.message}</p>
                      <p className="text-[#64748b] mt-1">{alert.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white border border-[#e2e8f0] rounded-sm">
              <div className="border-b border-[#e2e8f0] px-6 py-4">
                <h3 className="text-[#0a1628]">Required Documentation</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-sm hover:bg-[#f8fafc]"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <FileText className="size-5 text-[#64748b]" />
                        <div className="flex-1">
                          <div className="text-[#0a1628]">{doc.name}</div>
                          <div className="text-[#94a3b8]">{doc.type}</div>
                        </div>
                        <div>
                          {doc.status === 'verified' && (
                            <Badge className="bg-[#10b981] text-white rounded-sm">
                              Verified
                            </Badge>
                          )}
                          {doc.status === 'uploaded' && (
                            <Badge className="bg-[#0ea5e9] text-white rounded-sm">
                              Uploaded
                            </Badge>
                          )}
                          {doc.status === 'pending' && (
                            <Badge className="bg-[#ef4444] text-white rounded-sm">
                              Required
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {doc.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#e2e8f0] text-[#0a1628] hover:bg-[#f8fafc]"
                          >
                            <Upload className="size-4 mr-2" />
                            Upload
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#64748b] hover:text-[#0a1628]"
                          >
                            <Download className="size-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Document Stats */}
                <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-[#10b981]">2</div>
                      <div className="text-[#64748b]">Verified</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#0ea5e9]">1</div>
                      <div className="text-[#64748b]">Uploaded</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#ef4444]">2</div>
                      <div className="text-[#64748b]">Required</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
