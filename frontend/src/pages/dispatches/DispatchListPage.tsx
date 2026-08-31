import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Truck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface Dispatch {
  id: number;
  dispatch_number: string;
  project_name: string | null;
  status: string;
  vehicle_number: string | null;
  driver_name: string | null;
  items: Array<{ product_name: string; quantity: number }>;
  created_at: string;
}

export function DispatchListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
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
    api.get(`/dispatches/?${params}`)
      .then((res) => { setDispatches(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [page, status]);

  const statuses = ["", "DRAFT", "PENDING_APPROVAL", "APPROVED", "LOADING_VERIFICATION", "IN_TRANSIT", "DELIVERY_VERIFICATION", "DELIVERED"];

  return (
    <div>
      <PageHeader title="Dispatches" subtitle={`${total} dispatches`}
        action={<Link to="/dispatches/new"><Button><Plus className="h-4 w-4 mr-2" />New Dispatch</Button></Link>} />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {statuses.map((s) => (
          <button key={s}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${status === s ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => { const p = new URLSearchParams(searchParams); if (s) p.set("status", s); else p.delete("status"); p.set("page", "1"); setSearchParams(p); }}>
            {s === "" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : dispatches.length === 0 ? (
        <EmptyState icon={Truck} title="No dispatches" description="Create your first dispatch"
          action={<Link to="/dispatches/new"><Button><Plus className="h-4 w-4 mr-2" />New Dispatch</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Dispatch #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vehicle</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Driver</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Items</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dispatches.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/dispatches/${d.id}`}>
                  <td className="px-4 py-3 font-medium text-indigo-600">{d.dispatch_number}</td>
                  <td className="px-4 py-3 text-gray-900">{d.project_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{d.vehicle_number ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{d.driver_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{d.items?.length ?? 0} items</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
