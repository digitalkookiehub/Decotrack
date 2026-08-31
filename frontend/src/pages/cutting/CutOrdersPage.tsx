import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Scissors, Plus, BarChart3 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import api from "../../services/api";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import toast from "react-hot-toast";

interface CutOrder {
  id: number;
  cut_order_number: string;
  product_type: string;
  status: string;
  job_type: string;
  company_name: string | null;
  company_contact: string | null;
  company_phone: string | null;
  job_reference: string | null;
  wo_id: number | null;
  wo_number: string | null;
  sheets_required: number;
  sheets_consumed: number | null;
  wastage_percent: number;
  total_cost: number;
  material_name: string | null;
  creator_name: string | null;
  created_at: string;
}

interface CutStats {
  total_orders: number;
  own_orders: number;
  contract_orders: number;
  own_sheets: number;
  contract_sheets: number;
  total_sheets: number;
  own_cost: number;
  contract_cost: number;
  total_cost: number;
  avg_wastage_percent: number;
  by_status: { planned: number; cutting: number; completed: number };
  top_contractors: { company_name: string; orders: number; sheets: number; cost: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  CUTTING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export function CutOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<CutOrder[]>([]);
  const [stats, setStats] = useState<CutStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const search = searchParams.get("search") || "";
  const jobFilter = searchParams.get("job_type") || "";
  const statusFilter = searchParams.get("status") || "";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "20");
        if (search) params.set("search", search);
        if (jobFilter) params.set("job_type", jobFilter);
        if (statusFilter) params.set("status", statusFilter);

        const [ordersRes, statsRes] = await Promise.all([
          api.get(`/cutting/orders?${params}`),
          api.get("/cutting/orders/stats"),
        ]);
        setOrders(ordersRes.data.items);
        setTotal(ordersRes.data.total);
        setStats(statsRes.data);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page, search, jobFilter, statusFilter]);

  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
    setPage(1);
  };

  const handleStatusChange = async (order: CutOrder, newStatus: string) => {
    try {
      await api.put(`/cutting/orders/${order.id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);

      // Send WhatsApp message to contractor on completion
      if (newStatus === "COMPLETED" && order.job_type === "CONTRACT" && order.company_name) {
        const phone = (order.company_phone || "").replace(/[^0-9]/g, "");
        const message = [
          `✅ *Cutting Job Completed*`,
          ``,
          `Order: ${order.cut_order_number}`,
          `Material: ${order.material_name || "Plywood"}`,
          `Sheets: ${order.sheets_required}`,
          `Site: ${order.product_type || ""}`,
          ``,
          `Your cutting job is ready for pickup/delivery.`,
          `— DecoTrack`,
        ].join("\n");

        if (phone) {
          const waPhone = phone.startsWith("91") ? phone : `91${phone}`;
          const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
          window.open(waUrl, "_blank");
        } else {
          toast("No phone number for contractor. Copy message manually.", { icon: "📋" });
          navigator.clipboard.writeText(message.replace(/\*/g, ""));
        }
      }

      // Refresh
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("search", search);
      if (jobFilter) params.set("job_type", jobFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/cutting/orders?${params}`);
      setOrders(res.data.items);
      const statsRes = await api.get("/cutting/orders/stats");
      setStats(statsRes.data);
    } catch {
      // handled
    }
  };

  if (loading) return <LoadingSpinner text="Loading cut orders..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cut Orders"
        subtitle={`${total} orders — track contract & own cutting jobs`}
        action={
          <Link to="/cut-planner">
            <Button><Plus className="mr-2 h-4 w-4" /> New Cut Plan</Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="Total Orders" value={stats.total_orders} />
          <StatCard label="Own" value={stats.own_orders} sub={`${stats.own_sheets} sheets`} color="green" />
          <StatCard label="Contract" value={stats.contract_orders} sub={`${stats.contract_sheets} sheets`} color="amber" />
          <StatCard label="Total Sheets" value={stats.total_sheets} />
          <StatCard label="Total Cost" value={formatINR(stats.total_cost)} />
          <StatCard label="Avg Wastage" value={`${stats.avg_wastage_percent}%`}
            color={stats.avg_wastage_percent > 25 ? "red" : stats.avg_wastage_percent > 15 ? "amber" : "green"} />
        </div>
      )}

      {/* Top Contractors */}
      {stats && stats.top_contractors.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            <BarChart3 className="inline mr-1 h-4 w-4 text-indigo-600" />
            Top Contractors
          </h3>
          <div className="grid gap-2 lg:grid-cols-5">
            {stats.top_contractors.map((c) => (
              <div key={c.company_name} className="rounded-md border border-amber-100 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-gray-900">{c.company_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {c.orders} orders · {c.sheets} sheets · {formatINR(c.cost)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by order #, site, company..." className="pl-9"
            defaultValue={search}
            onChange={(e) => handleFilter("search", e.target.value)} />
        </div>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={jobFilter} onChange={(e) => handleFilter("job_type", e.target.value)}>
          <option value="">All Types</option>
          <option value="OWN">Own Project</option>
          <option value="CONTRACT">Contract</option>
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter} onChange={(e) => handleFilter("status", e.target.value)}>
          <option value="">All Status</option>
          <option value="PLANNED">Planned</option>
          <option value="CUTTING">Cutting</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <EmptyState icon={Scissors} title="No cut orders yet"
          description="Create your first cut plan to start tracking"
          action={<Link to="/cut-planner"><Button><Plus className="mr-2 h-4 w-4" /> New Cut Plan</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Company / Site</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Sheets</th>
                <th className="px-4 py-3">Wastage</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/cut-orders/${o.id}`} className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
                      {o.cut_order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {o.job_type === "CONTRACT" ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">Contract</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Own</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {o.company_name && <p className="font-medium text-gray-900">{o.company_name}</p>}
                    <p className="text-gray-500 text-xs">{o.product_type || "—"}</p>
                    {o.wo_number && (
                      <Link to={`/work-orders/${o.wo_id}`} className="text-[10px] text-indigo-600 hover:underline">
                        → {o.wo_number}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{o.material_name}</td>
                  <td className="px-4 py-3 font-medium">
                    {o.sheets_consumed ?? o.sheets_required}
                    {o.sheets_consumed != null && o.sheets_consumed !== o.sheets_required && (
                      <span className="text-xs text-gray-400"> / {o.sheets_required} planned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={o.wastage_percent > 25 ? "text-red-600 font-semibold" :
                      o.wastage_percent > 15 ? "text-amber-600" : "text-green-600"}>
                      {o.wastage_percent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatINR(o.total_cost)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] || ""}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3">
                    {o.status === "PLANNED" && (
                      <button onClick={() => handleStatusChange(o, "CUTTING")}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                        Start Cutting
                      </button>
                    )}
                    {o.status === "CUTTING" && (
                      <button onClick={() => handleStatusChange(o, "COMPLETED")}
                        className="text-xs text-green-600 hover:text-green-700 font-medium">
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const bg = color === "green" ? "bg-green-50 border-green-200" :
    color === "amber" ? "bg-amber-50 border-amber-200" :
    color === "red" ? "bg-red-50 border-red-200" :
    "bg-white border-gray-200";
  const text = color === "green" ? "text-green-700" :
    color === "amber" ? "text-amber-700" :
    color === "red" ? "text-red-700" :
    "text-gray-900";
  return (
    <div className={`rounded-lg border p-3 text-center ${bg}`}>
      <p className={`text-xl font-bold ${text}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
