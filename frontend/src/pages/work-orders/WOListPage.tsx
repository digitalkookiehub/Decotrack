import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Factory } from "lucide-react";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface WO {
  id: number;
  wo_number: string;
  project_name: string | null;
  status: string;
  estimated_material_cost: number;
  items: Array<{ product_name: string; quantity: number; completed_count: number; status: string }>;
  created_at: string;
}

export function WOListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [wos, setWOs] = useState<WO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "20");
    if (status) params.set("status", status);
    api.get(`/work-orders/?${params}`)
      .then((res) => { setWOs(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [page, status]);

  const statuses = ["", "DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "COMPLETED", "REJECTED"];

  return (
    <div>
      <PageHeader title="Work Orders" subtitle={`${total} work orders`}
        action={<Link to="/work-orders/new"><Button><Plus className="h-4 w-4 mr-2" />New Work Order</Button></Link>} />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {statuses.map((s) => (
          <button key={s}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${status === s ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => { const p = new URLSearchParams(searchParams); if (s) p.set("status", s); else p.delete("status"); p.set("page","1"); setSearchParams(p); }}>
            {s === "" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : wos.length === 0 ? (
        <EmptyState icon={Factory} title="No work orders" description="Create your first work order"
          action={<Link to="/work-orders/new"><Button><Plus className="h-4 w-4 mr-2" />New Work Order</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">WO Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Est. Cost</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Products</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {wos.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/work-orders/${wo.id}`}>
                  <td className="px-4 py-3 font-medium text-indigo-600">{wo.wo_number}</td>
                  <td className="px-4 py-3 text-gray-900">{wo.project_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={wo.status} /></td>
                  <td className="px-4 py-3 text-right">{formatINR(wo.estimated_material_cost)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {wo.items?.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-xs text-gray-600">
                          {item.product_name} x{item.quantity}
                          {item.completed_count > 0 && <span className="text-green-600 ml-1">({item.completed_count} done)</span>}
                        </div>
                      ))}
                      {(wo.items?.length ?? 0) > 3 && <div className="text-xs text-gray-400">+{wo.items.length - 3} more</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(wo.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
