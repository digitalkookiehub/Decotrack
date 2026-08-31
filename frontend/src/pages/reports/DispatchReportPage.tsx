import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatDateTime } from "../../lib/date";
import api from "../../services/api";

interface DispatchLog {
  id: number;
  dispatch_number: string;
  project_name: string | null;
  status: string;
  driver_name: string | null;
  vehicle_number: string | null;
  loading_confirmed_at: string | null;
  delivery_confirmed_at: string | null;
  created_at: string;
}

export function DispatchReportPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/dispatch-log").then((res) => { setItems(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Dispatch Log" subtitle={`${items.length} dispatches`}
        action={<Button variant="outline" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      {items.length === 0 ? (
        <EmptyState icon={Truck} title="No dispatches" description="Dispatches will appear here once created" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Dispatch #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Driver</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vehicle</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Loading</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Delivered</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/dispatches/${d.id}`)}>
                  <td className="px-4 py-3 font-medium text-indigo-600">{d.dispatch_number}</td>
                  <td className="px-4 py-3">{d.project_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{d.driver_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{d.vehicle_number ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{d.loading_confirmed_at ? formatDateTime(d.loading_confirmed_at) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{d.delivery_confirmed_at ? formatDateTime(d.delivery_confirmed_at) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
