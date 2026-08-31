import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { ShoppingCart } from "lucide-react";
import api from "../../services/api";

interface VendorSpend {
  vendor: string;
  total_spend: number;
  po_count: number;
}

export function PurchaseReportPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<VendorSpend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/purchase-analytics").then((res) => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const totalSpend = data.reduce((s, d) => s + d.total_spend, 0);

  return (
    <div>
      <PageHeader title="Purchase Analytics" subtitle="Spend analysis by vendor"
        action={<Button variant="outline" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      {data.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No purchase data" description="Create and approve purchase orders to see analytics" />
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Total Purchase Spend</p>
              <p className="text-3xl font-bold text-indigo-600">{formatINR(totalSpend)}</p>
              <p className="text-xs text-gray-400 mt-1">across {data.length} vendors</p>
            </CardContent>
          </Card>

          {/* Bar chart visualization using divs */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">Vendor Spend Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.map((d) => {
                  const pct = totalSpend > 0 ? (d.total_spend / totalSpend) * 100 : 0;
                  return (
                    <div key={d.vendor}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{d.vendor}</span>
                        <span className="text-gray-500">{formatINR(d.total_spend)} ({d.po_count} POs)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-indigo-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">PO Count</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((d) => (
                  <tr key={d.vendor}>
                    <td className="px-4 py-3 font-medium">{d.vendor}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(d.total_spend)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{d.po_count}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{totalSpend > 0 ? ((d.total_spend / totalSpend) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
