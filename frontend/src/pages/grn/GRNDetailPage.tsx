import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR, formatNumber } from "../../lib/currency";
import { formatDate, formatDateTime } from "../../lib/date";
import api from "../../services/api";

interface GRNItem {
  id: number;
  raw_material_id: number;
  material_name: string | null;
  material_sku: string | null;
  ordered_qty: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  quality_status: string;
  rejection_reason: string | null;
  rate: number;
}

interface GRN {
  id: number;
  grn_number: string;
  po_id: number;
  po_number: string | null;
  vendor_name: string | null;
  receiver_name: string | null;
  received_date: string;
  notes: string | null;
  created_at: string;
  items: GRNItem[];
}

export function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [grn, setGRN] = useState<GRN | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/grn/${id}`).then((res) => { setGRN(res.data); setLoading(false); });
  }, [id]);

  if (loading || !grn) return <LoadingSpinner />;

  const totalAccepted = grn.items.reduce((sum, i) => sum + i.accepted_qty * i.rate, 0);
  const totalRejected = grn.items.reduce((sum, i) => sum + i.rejected_qty, 0);

  const getQualityIcon = (status: string) => {
    switch (status) {
      case "ACCEPTED": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED": return <XCircle className="h-4 w-4 text-red-500" />;
      case "PARTIAL": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return null;
    }
  };

  const getQualityBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED": return <Badge className="bg-green-100 text-green-700 text-[10px]">Accepted</Badge>;
      case "REJECTED": return <Badge className="bg-red-100 text-red-700 text-[10px]">Rejected</Badge>;
      case "PARTIAL": return <Badge className="bg-amber-100 text-amber-700 text-[10px]">Partial</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div>
      <PageHeader title={grn.grn_number}
        subtitle={`Against ${grn.po_number ?? "PO"} from ${grn.vendor_name ?? "vendor"}`}
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block">PO Number</span>
                  <Link to={`/purchase-orders/${grn.po_id}`} className="font-medium text-indigo-600 hover:underline">
                    {grn.po_number}
                  </Link>
                </div>
                <div>
                  <span className="text-gray-500 block">Vendor</span>
                  <span className="font-medium">{grn.vendor_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Received Date</span>
                  <span className="font-medium">{formatDate(grn.received_date)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Received By</span>
                  <span className="font-medium">{grn.receiver_name}</span>
                </div>
              </div>
              {grn.notes && (
                <div className="mt-3 pt-3 border-t text-sm">
                  <span className="text-gray-500">Notes: </span>
                  <span className="text-gray-700">{grn.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader><CardTitle className="text-base">Received Items ({grn.items.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Material</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Received</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Accepted</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Rejected</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Quality</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Rate</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grn.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.material_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.material_sku}</div>
                      </td>
                      <td className="px-4 py-2 text-right">{formatNumber(item.received_qty)}</td>
                      <td className="px-4 py-2 text-right text-green-700 font-medium">{formatNumber(item.accepted_qty)}</td>
                      <td className="px-4 py-2 text-right">
                        {item.rejected_qty > 0 ? (
                          <span className="text-red-600 font-medium">{formatNumber(item.rejected_qty)}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getQualityIcon(item.quality_status)}
                          {getQualityBadge(item.quality_status)}
                        </div>
                        {item.rejection_reason && (
                          <p className="text-[10px] text-red-500 mt-1">{item.rejection_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{formatINR(item.rate)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatINR(item.accepted_qty * item.rate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right font-medium text-gray-700">Total Accepted Value</td>
                    <td className="px-4 py-2 text-right font-bold text-lg">{formatINR(totalAccepted)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Items</span>
                <span className="font-medium">{grn.items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Accepted Value</span>
                <span className="font-medium text-green-700">{formatINR(totalAccepted)}</span>
              </div>
              {totalRejected > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rejected Items</span>
                  <span className="font-medium text-red-600">{totalRejected} units</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created</span>
                <span>{formatDateTime(grn.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">What Happened</CardTitle></CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Accepted materials added to inventory as new batches</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Stock levels updated for each accepted material</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Last purchase rate updated per material</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>PO receipt status auto-updated</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
