import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR, formatNumber } from "../../lib/currency";
import api from "../../services/api";

interface StockItem {
  id: number;
  name: string;
  sku: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  last_purchase_rate: number;
  value: number;
  below_reorder: boolean;
}

export function StockReportPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/stock-summary").then((res) => { setItems(res.data); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;

  const totalValue = items.reduce((s, i) => s + i.value, 0);
  const belowReorder = items.filter((i) => i.below_reorder).length;

  return (
    <div>
      <PageHeader title="Stock Summary" subtitle={`${items.length} materials`}
        action={<Button variant="outline" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-gray-500">Total Materials</p>
          <p className="text-2xl font-bold">{items.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-gray-500">Total Stock Value</p>
          <p className="text-2xl font-bold text-green-600">{formatINR(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-gray-500">Below Reorder</p>
          <p className="text-2xl font-bold text-red-600">{belowReorder}</p>
        </CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Material</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Stock</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Reorder Level</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Rate</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((i) => (
              <tr key={i.id} className={i.below_reorder ? "bg-red-50" : ""}>
                <td className="px-4 py-3 font-medium">{i.name}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i.sku}</td>
                <td className="px-4 py-3 text-right">{formatNumber(i.current_stock)} {i.unit}</td>
                <td className="px-4 py-3 text-right text-gray-500">{formatNumber(i.reorder_level)} {i.unit}</td>
                <td className="px-4 py-3 text-right">{formatINR(i.last_purchase_rate)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatINR(i.value)}</td>
                <td className="px-4 py-3 text-center">
                  {i.below_reorder ? (
                    <Badge variant="destructive" className="text-[10px]">Low</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-semibold">Total Value</td>
              <td className="px-4 py-3 text-right font-bold text-lg">{formatINR(totalValue)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
