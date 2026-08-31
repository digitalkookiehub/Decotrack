import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatNumber } from "../../lib/currency";
import { formatDateTime } from "../../lib/date";
import api from "../../services/api";

interface Movement {
  id: number;
  material_name: string | null;
  movement_type: string;
  quantity: number;
  qty_before: number;
  qty_after: number;
  reference_type: string | null;
  reference_id: number | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export function AuditTrailPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const movementType = searchParams.get("type") || "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "30");
    if (movementType) params.set("movement_type", movementType);
    api.get(`/reports/audit-trail?${params}`)
      .then((res) => { setItems(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [page, movementType]);

  const types = ["", "GRN_IN", "WO_ISSUE", "WO_RETURN", "ADJUSTMENT", "WASTAGE"];

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "GRN_IN": return <Badge className="bg-green-100 text-green-700 text-[10px]">GRN IN</Badge>;
      case "WO_ISSUE": return <Badge className="bg-blue-100 text-blue-700 text-[10px]">WO ISSUE</Badge>;
      case "WO_RETURN": return <Badge className="bg-purple-100 text-purple-700 text-[10px]">WO RETURN</Badge>;
      case "ADJUSTMENT": return <Badge className="bg-amber-100 text-amber-700 text-[10px]">ADJUST</Badge>;
      case "WASTAGE": return <Badge className="bg-red-100 text-red-700 text-[10px]">WASTAGE</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle={`${total} inventory movements`}
        action={<Button variant="outline" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {types.map((t) => (
          <button key={t}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${movementType === t ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => { const p = new URLSearchParams(searchParams); if (t) p.set("type", t); else p.delete("type"); p.set("page", "1"); setSearchParams(p); }}>
            {t === "" ? "All" : t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <EmptyState icon={FileText} title="No movements" description="Inventory movements appear here as stock changes" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Material</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Before</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">After</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3 font-medium">{m.material_name ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{getTypeBadge(m.movement_type)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={m.quantity > 0 ? "text-green-600" : "text-red-600"}>
                        {m.quantity > 0 ? "+" : ""}{formatNumber(m.quantity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatNumber(m.qty_before)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatNumber(m.qty_after)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {m.reference_type && `${m.reference_type} #${m.reference_id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.performed_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 30 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 30)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1}
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page - 1)); setSearchParams(p); }}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 30 >= total}
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page + 1)); setSearchParams(p); }}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
