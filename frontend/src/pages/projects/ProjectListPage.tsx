import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, FolderKanban } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface Project {
  id: number;
  project_number: string;
  name: string;
  client_name: string | null;
  status: string;
  estimated_cost: number;
  actual_cost: number;
  items_count: number;
  created_at: string;
}

export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "20");
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    api.get(`/projects/?${params}`)
      .then((res) => { setProjects(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [page, status, search]);

  const statuses = ["", "PLANNING", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"];

  return (
    <div>
      <PageHeader title="Projects" subtitle={`${total} projects`}
        action={<Link to="/projects/new"><Button><Plus className="h-4 w-4 mr-2" />New Project</Button></Link>} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search projects..." className="pl-9" defaultValue={search}
            onChange={(e) => { const p = new URLSearchParams(searchParams); if (e.target.value) p.set("search", e.target.value); else p.delete("search"); p.set("page","1"); setSearchParams(p); }} />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {statuses.map((s) => (
            <button key={s}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${status === s ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              onClick={() => { const p = new URLSearchParams(searchParams); if (s) p.set("status", s); else p.delete("status"); p.set("page","1"); setSearchParams(p); }}>
              {s === "" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects" description="Create your first project"
          action={<Link to="/projects/new"><Button><Plus className="h-4 w-4 mr-2" />New Project</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Estimated</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Items</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/projects/${p.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-indigo-600">{p.project_number}</div>
                    <div className="text-gray-900">{p.name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.client_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right">{formatINR(p.estimated_cost)}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{p.items_count}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
