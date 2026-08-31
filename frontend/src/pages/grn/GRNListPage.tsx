import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, ClipboardCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface GRN {
  id: number;
  grn_number: string;
  po_id: number;
  po_number: string | null;
  vendor_name: string | null;
  receiver_name: string | null;
  received_date: string;
  items: Array<{
    material_name: string;
    accepted_qty: number;
    rejected_qty: number;
    rate: number;
  }>;
  created_at: string;
}

export function GRNListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [grns, setGRNs] = useState<GRN[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");

  useEffect(() => {
    setLoading(true);
    api.get(`/grn/?page=${page}&per_page=20`)
      .then((res) => { setGRNs(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <PageHeader title="Goods Received Notes" subtitle={`${total} GRNs`}
        action={<Link to="/grn/new"><Button><Plus className="h-4 w-4 mr-2" />New GRN</Button></Link>} />

      {loading ? <LoadingSpinner /> : grns.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No GRNs yet" description="Create a GRN when materials arrive from a vendor"
          action={<Link to="/grn/new"><Button><Plus className="h-4 w-4 mr-2" />New GRN</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">GRN #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">PO #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Received By</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Items</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grns.map((g) => {
                const totalValue = g.items.reduce((sum, i) => sum + i.accepted_qty * i.rate, 0);
                const totalRejected = g.items.reduce((sum, i) => sum + i.rejected_qty, 0);
                return (
                  <tr key={g.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/grn/${g.id}`}>
                    <td className="px-4 py-3 font-medium text-indigo-600">{g.grn_number}</td>
                    <td className="px-4 py-3 text-gray-700">{g.po_number ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{g.vendor_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{g.receiver_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(g.received_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-700">{g.items.length}</span>
                      {totalRejected > 0 && <span className="text-red-500 text-xs ml-1">({totalRejected} rejected)</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(totalValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page - 1)); setSearchParams(p); }}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page + 1)); setSearchParams(p); }}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
