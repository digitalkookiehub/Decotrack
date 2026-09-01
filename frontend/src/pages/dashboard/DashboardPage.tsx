import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  FolderKanban,
  Factory,
  AlertTriangle,
  Clock,
  IndianRupee,
  Truck,
  Users,
  Building2,
  ClipboardCheck,
  BarChart3,
  PhoneCall,
  Scissors,
  UserPlus,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { PageHeader } from "../../components/shared/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { formatINR } from "../../lib/currency";
import { formatRelative } from "../../lib/date";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "../../services/api";

interface DashboardData {
  reorder_alerts: number;
  pending_approvals: {
    purchase_orders: number;
    work_orders: number;
    dispatches: number;
    total: number;
  };
  active_work_orders?: number;
  active_projects?: number;
  stock_summary?: { total_materials: number; total_value: number };
  counts?: Record<string, number>;
  recent_pos?: Array<{ id: number; po_number: string; vendor_name: string | null; status: string; total_amount: number; created_at: string }>;
  recent_wos?: Array<{ id: number; wo_number: string; project_name: string | null; status: string; created_at: string }>;
  projects?: { active: number; total: number };
  work_orders?: { active: number; completed: number };
  dispatches?: { in_transit: number; delivered: number };
}

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [charts, setCharts] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoint = isAdmin() ? "/dashboard/admin" : "/dashboard/employee";
    Promise.all([
      api.get(endpoint),
      api.get("/dashboard/charts"),
    ]).then(([dashRes, chartRes]) => {
      setData(dashRes.data);
      setCharts(chartRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center text-gray-500 mt-10">Failed to load dashboard</div>;

  const approvals = data.pending_approvals;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(" ")[0] ?? "User"}`}
        subtitle={isAdmin() ? "Admin Dashboard" : "Employee Dashboard"}
      />

      {/* Pending Approvals Banner */}
      {approvals.total > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">
                {approvals.total} pending approval{approvals.total > 1 ? "s" : ""}
              </p>
              <div className="flex gap-3 mt-1">
                {approvals.purchase_orders > 0 && <span className="text-sm text-amber-600">{approvals.purchase_orders} PO</span>}
                {approvals.work_orders > 0 && <span className="text-sm text-amber-600">{approvals.work_orders} WO</span>}
                {approvals.dispatches > 0 && <span className="text-sm text-amber-600">{approvals.dispatches} Dispatch</span>}
              </div>
            </div>
            <Link to="/approvals"><Button size="sm">View Approvals</Button></Link>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Link to="/inventory/alerts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <AlertTriangle className={`h-5 w-5 mb-2 ${(data.reorder_alerts || 0) > 0 ? "text-red-500" : "text-gray-400"}`} />
              <p className="text-2xl font-bold">{data.reorder_alerts || 0}</p>
              <p className="text-xs text-gray-500">Reorder Alerts</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/inventory/materials">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <IndianRupee className="h-5 w-5 text-green-500 mb-2" />
              <p className="text-lg font-bold">{formatINR(data.stock_summary?.total_value || 0)}</p>
              <p className="text-xs text-gray-500">{data.stock_summary?.total_materials || 0} materials</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/projects">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <FolderKanban className="h-5 w-5 text-indigo-500 mb-2" />
              <p className="text-2xl font-bold">{data.active_projects ?? data.projects?.active ?? 0}</p>
              <p className="text-xs text-gray-500">Active Projects</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/work-orders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <Factory className="h-5 w-5 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{data.active_work_orders ?? data.work_orders?.active ?? 0}</p>
              <p className="text-xs text-gray-500">Active WOs</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/dispatches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <Truck className="h-5 w-5 text-amber-500 mb-2" />
              <p className="text-2xl font-bold">{data.dispatches?.in_transit ?? data.counts?.dispatches ?? 0}</p>
              <p className="text-xs text-gray-500">{data.dispatches ? "In Transit" : "Dispatches"}</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/approvals">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <Clock className={`h-5 w-5 mb-2 ${approvals.total > 0 ? "text-amber-500" : "text-gray-400"}`} />
              <p className="text-2xl font-bold">{approvals.total}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts Section */}
      {charts && <DashboardCharts charts={charts} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Purchase Orders */}
        {data.recent_pos && data.recent_pos.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
              <Link to="/purchase-orders"><Button variant="outline" size="sm">View All</Button></Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {data.recent_pos.map((po) => (
                  <Link key={po.id} to={`/purchase-orders/${po.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{po.po_number}</p>
                      <p className="text-xs text-gray-500">{po.vendor_name} · {formatRelative(po.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatINR(po.total_amount)}</p>
                      <StatusBadge status={po.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Work Orders */}
        {data.recent_wos && data.recent_wos.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Recent Work Orders</CardTitle>
              <Link to="/work-orders"><Button variant="outline" size="sm">View All</Button></Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {data.recent_wos.map((wo) => (
                  <Link key={wo.id} to={`/work-orders/${wo.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{wo.wo_number}</p>
                      <p className="text-xs text-gray-500">{wo.project_name} · {formatRelative(wo.created_at)}</p>
                    </div>
                    <StatusBadge status={wo.status} />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions + System Overview */}
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { to: "/purchase-orders/new", icon: ShoppingCart, label: "New PO" },
                { to: "/work-orders/new", icon: Factory, label: "New Work Order" },
                { to: "/dispatches/new", icon: Truck, label: "New Dispatch" },
                { to: "/grn/new", icon: ClipboardCheck, label: "Receive Materials" },
                { to: "/projects/new", icon: FolderKanban, label: "New Project" },
                { to: "/crm/quick-log", icon: Phone, label: "Log Call" },
                { to: "/crm/leads?new=true", icon: UserPlus, label: "New Lead" },
                { to: "/cut-planner", icon: Scissors, label: "Cut Planner" },
                { to: "/cut-orders", icon: ClipboardCheck, label: "Cut Orders" },
                { to: "/crm", icon: PhoneCall, label: "CRM Dashboard" },
                { to: "/reports", icon: BarChart3, label: "Reports" },
              ].map((item) => (
                <Link key={item.to} to={item.to}>
                  <Button variant="outline" className="w-full h-16 flex-col gap-1">
                    <item.icon className="h-4 w-4" />
                    <span className="text-xs">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {data.counts && (
          <Card>
            <CardHeader><CardTitle className="text-base">System Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Projects", value: data.counts.projects, icon: FolderKanban, to: "/projects" },
                  { label: "Clients", value: data.counts.clients, icon: Users, to: "/clients" },
                  { label: "Vendors", value: data.counts.vendors, icon: Building2, to: "/vendors" },
                  { label: "Purchase Orders", value: data.counts.purchase_orders, icon: ShoppingCart, to: "/purchase-orders" },
                  { label: "Work Orders", value: data.counts.work_orders, icon: Factory, to: "/work-orders" },
                  { label: "GRNs", value: data.counts.grns, icon: ClipboardCheck, to: "/grn" },
                ].map((item) => (
                  <Link key={item.label} to={item.to}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <item.icon className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-lg font-bold">{item.value}</p>
                        <p className="text-xs text-gray-500">{item.label}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Business Flow Guide */}
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">How DecoTrack Works — Complete Business Flow</CardTitle></CardHeader>
        <CardContent>
          {/* Main Pipeline */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {[
              { label: "CRM", sub: "Lead → Follow-up → Client", color: "bg-pink-100 text-pink-700 border-pink-300", to: "/crm" },
              { label: "Project", sub: "Client + Room items", color: "bg-indigo-100 text-indigo-700 border-indigo-300", to: "/projects" },
              { label: "Purchase", sub: "PO → Approve → GRN", color: "bg-blue-100 text-blue-700 border-blue-300", to: "/purchase-orders" },
              { label: "Work Order", sub: "Material check → Approve", color: "bg-purple-100 text-purple-700 border-purple-300", to: "/work-orders" },
              { label: "Cut Planner", sub: "Quick / Job Mode", color: "bg-orange-100 text-orange-700 border-orange-300", to: "/cut-planner" },
              { label: "Production", sub: "Cutting → QC → FG", color: "bg-amber-100 text-amber-700 border-amber-300", to: "/production" },
              { label: "Dispatch", sub: "Photos → Deliver", color: "bg-green-100 text-green-700 border-green-300", to: "/dispatches" },
            ].map((step, idx) => (
              <div key={step.label} className="flex items-center">
                {idx > 0 && <span className="text-gray-300 text-xl mx-1">→</span>}
                <Link to={step.to}>
                  <div className={`rounded-lg border px-3 py-2.5 text-center min-w-[110px] hover:shadow-md transition-shadow cursor-pointer ${step.color}`}>
                    <p className="font-semibold text-sm">{step.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-75">{step.sub}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* Two Flow Paths */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="font-semibold text-gray-800 mb-3 text-sm">Two Ways Work Comes In</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-indigo-200 bg-white p-3">
                <p className="font-semibold text-indigo-700 text-xs mb-2">Path 1: Own Project (Your Client)</p>
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {["CRM Lead", "→", "Client", "→", "Project", "→", "PO (buy materials)", "→", "WO (material check)", "→", "Cut Planner (Job Mode)", "→", "Production", "→", "Dispatch", "→", "Delivery"].map((s, i) => (
                    <span key={i} className={s === "→" ? "text-gray-300" : "rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5"}>{s}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="font-semibold text-amber-700 text-xs mb-2">Path 2: Contract Job (Other Company's Work)</p>
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {["Contractor calls", "→", "Cut Planner (Job Mode)", "→", "CO + WO auto-created", "→", "Cutting", "→", "Complete", "→", "WhatsApp contractor"].map((s, i) => (
                    <span key={i} className={s === "→" ? "text-gray-300" : "rounded bg-amber-50 border border-amber-100 px-1.5 py-0.5"}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            {/* CRM */}
            <div className="rounded-lg border border-pink-200 bg-pink-50/50 p-4">
              <h4 className="font-semibold text-pink-800 mb-3 flex items-center gap-2">
                <PhoneCall className="h-4 w-4" /> CRM
              </h4>
              <div className="space-y-2 text-xs text-pink-900">
                <Step n={1}>Customer calls / WhatsApp / website form → <strong>Lead auto-created</strong></Step>
                <Step n={2}>Log calls, schedule <strong>follow-ups</strong> with push reminders</Step>
                <Step n={3}>Pipeline: <strong>New → Contacted → Site Visit → Quote → Negotiation → Won</strong></Step>
                <Step n={4}>Won → <strong>auto-creates Client + Project</strong></Step>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/crm"><Button size="sm" variant="outline" className="text-xs h-7">CRM</Button></Link>
                <Link to="/crm/quick-log"><Button size="sm" variant="outline" className="text-xs h-7">Log Call</Button></Link>
                <Link to="/crm/leads?new=true"><Button size="sm" variant="outline" className="text-xs h-7">New Lead</Button></Link>
              </div>
            </div>

            {/* Procurement */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Procurement
              </h4>
              <div className="space-y-2 text-xs text-blue-900">
                <Step n={1}><strong>Reorder Alert</strong> when stock drops below level</Step>
                <Step n={2}>Create <strong>Purchase Order</strong> → vendor + items + rates</Step>
                <Step n={3}>Submit → <strong>Admin approves</strong> (Gate 1)</Step>
                <Step n={4}>Materials arrive → <strong>GRN</strong> → stock auto-updates via FIFO</Step>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/purchase-orders/new"><Button size="sm" variant="outline" className="text-xs h-7">New PO</Button></Link>
                <Link to="/grn/new"><Button size="sm" variant="outline" className="text-xs h-7">New GRN</Button></Link>
              </div>
            </div>

            {/* Work Order + Production */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
              <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <Factory className="h-4 w-4" /> Work Order → Production
              </h4>
              <div className="space-y-2 text-xs text-purple-900">
                <Step n={1}>Create <strong>Work Order</strong> → select project & products</Step>
                <Step n={2}><strong>Material check</strong> — cannot submit if materials short</Step>
                <Step n={3}>Submit → <strong>Admin approves</strong> (Gate 2) → materials auto-issued</Step>
                <Step n={4}>WO page: <strong>"Create Cut Plan"</strong> button → opens Cut Planner</Step>
                <Step n={5}>Production stages: <strong>Cutting → Edging → Assembly → QC</strong></Step>
                <Step n={6}>QC pass → <strong>Finished Good auto-created</strong> in inventory</Step>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/work-orders/new"><Button size="sm" variant="outline" className="text-xs h-7">New WO</Button></Link>
                <Link to="/production"><Button size="sm" variant="outline" className="text-xs h-7">Production</Button></Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Cut Planner (merged) */}
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                <Scissors className="h-4 w-4" /> Cut Planner
              </h4>
              <div className="space-y-2 text-xs text-orange-900">
                <Step n={1}>Enter panels (with 🌾 grain lock) + multiple stock sheet sizes</Step>
                <Step n={2}>Options: blade kerf, guillotine/free cut, CSV import/export</Step>
                <Step n={3}><strong>Quick Mode</strong>: instant calculate, no save (like a calculator)</Step>
                <Step n={4}><strong>Job Mode</strong>: saves as <strong>Cut Order (CO-xxxx)</strong> + auto-creates WO</Step>
                <Step n={5}>Own Project or Contract Job (with contractor details)</Step>
                <Step n={6}>Visual sheet layouts → <strong>download PDF</strong></Step>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/cut-planner"><Button size="sm" variant="outline" className="text-xs h-7">Cut Planner</Button></Link>
                <Link to="/cut-orders"><Button size="sm" variant="outline" className="text-xs h-7">Cut Orders</Button></Link>
              </div>
            </div>

            {/* Dispatch & Delivery */}
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
              <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" /> Dispatch & Delivery
              </h4>
              <div className="space-y-2 text-xs text-green-900">
                <Step n={1}>Create <strong>Dispatch</strong> → select finished goods & driver</Step>
                <Step n={2}>Submit → <strong>Admin approves</strong> (Gate 3)</Step>
                <Step n={3}><strong>Factory photos</strong> per item → confirm loading</Step>
                <Step n={4}>Auto-generates <strong>delivery link</strong> for driver (no app needed)</Step>
                <Step n={5}>Driver uploads <strong>delivery photos</strong> → mark delivered</Step>
                <Step n={6}>Employee reviews photos → <strong>confirm delivery</strong></Step>
              </div>
              <div className="mt-3">
                <Link to="/dispatches/new"><Button size="sm" variant="outline" className="text-xs h-7">New Dispatch</Button></Link>
              </div>
            </div>

            {/* Contract Jobs */}
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4">
              <h4 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Contract Cutting Jobs
              </h4>
              <div className="space-y-2 text-xs text-teal-900">
                <Step n={1}>Other interior company sends <strong>cutting sizes</strong></Step>
                <Step n={2}>Cut Planner → <strong>Job Mode</strong> → select "Contract"</Step>
                <Step n={3}>Enter: company name, contact, phone, their ref #</Step>
                <Step n={4}>Calculate → Save → <strong>CO-xxxx + WO auto-created</strong></Step>
                <Step n={5}>Cut Orders: <strong>PLANNED → CUTTING → COMPLETED</strong></Step>
                <Step n={6}>On complete → <strong>WhatsApp notification</strong> to contractor</Step>
                <Step n={7}>Dashboard shows: orders, sheets, cost <strong>per contractor</strong></Step>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/cut-planner"><Button size="sm" variant="outline" className="text-xs h-7">New Contract Job</Button></Link>
                <Link to="/cut-orders"><Button size="sm" variant="outline" className="text-xs h-7">All Orders</Button></Link>
              </div>
            </div>
          </div>

          {/* Approval Gates */}
          <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h4 className="font-semibold text-amber-800 mb-2 text-sm">3 Approval Gates (Multi-Admin, Race-Condition Safe)</h4>
            <div className="grid grid-cols-3 gap-4 text-xs text-amber-900">
              <div>
                <p className="font-medium">Gate 1: Purchase Order</p>
                <p className="opacity-75">Admin sees vendor, items, rates, total. Rejection requires reason.</p>
              </div>
              <div>
                <p className="font-medium">Gate 2: Work Order</p>
                <p className="opacity-75">Blocked if materials insufficient. Admin sees BOM cost + stock status.</p>
              </div>
              <div>
                <p className="font-medium">Gate 3: Dispatch</p>
                <p className="opacity-75">Admin sees project, items, vehicle, driver. Loading photos required.</p>
              </div>
            </div>
            <p className="text-[10px] text-amber-700 mt-2">All admins notified → first to act locks it → 4-hour escalation reminders</p>
          </div>

          {/* Key Features Summary */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "FIFO Inventory", desc: "Oldest batch consumed first" },
              { label: "Auto-Numbering", desc: "PO/WO/CO/DSP-YYYY-NNNN" },
              { label: "Photo Verification", desc: "Loading + delivery photos" },
              { label: "WhatsApp Alerts", desc: "Contract job completion" },
              { label: "CSV Import", desc: "Bulk panel/part entry" },
              { label: "PDF Export", desc: "Cut plans with layouts" },
              { label: "Grain Direction", desc: "Lock rotation per panel" },
              { label: "Material Check", desc: "Blocks WO if stock short" },
            ].map((f) => (
              <div key={f.label} className="rounded border border-gray-100 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-gray-800">{f.label}</p>
                <p className="text-[10px] text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

function DashboardCharts({ charts }: { charts: Record<string, unknown> }) {
  const monthly = charts.monthly as { labels: string[]; purchase_amounts: number[]; work_orders: number[]; dispatches: number[] };
  const projectStatuses = charts.project_statuses as Record<string, number>;
  const woStatuses = charts.wo_statuses as Record<string, number>;
  const topMaterials = charts.top_materials as { name: string; value: number }[];
  const cutOrders = charts.cut_orders as { own: number; contract: number };

  const barData = monthly.labels.map((label, i) => ({
    month: label,
    "Purchase (₹)": monthly.purchase_amounts[i],
    "Work Orders": monthly.work_orders[i],
    "Dispatches": monthly.dispatches[i],
  }));

  const projectPieData = Object.entries(projectStatuses).map(([k, v]) => ({ name: k.replace("_", " "), value: v }));
  const woPieData = Object.entries(woStatuses).map(([k, v]) => ({ name: k.replace("_", " "), value: v }));
  const cutPieData = [
    { name: "Own", value: cutOrders.own },
    { name: "Contract", value: cutOrders.contract },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2 mb-6">
      {/* Monthly Purchase Trend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Purchase Orders (₹)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="Purchase (₹)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly WO + Dispatch */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Work Orders & Dispatches</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="Work Orders" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Dispatches" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Project Status Pie */}
      {projectPieData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Projects by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={projectPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {projectPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Materials by Value */}
      {topMaterials.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Materials by Stock Value</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topMaterials} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cut Orders: Own vs Contract */}
      {cutPieData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cut Orders: Own vs Contract</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={cutPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* WO Status Distribution */}
      {woPieData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Work Orders by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={woPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {woPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px] font-bold flex-shrink-0 opacity-60">{n}</span>
      <span>{children}</span>
    </div>
  );
}
