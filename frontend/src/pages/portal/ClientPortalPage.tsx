import { useState } from "react";
import { Phone, FolderKanban, FileText, Truck, LogOut, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";
import toast from "react-hot-toast";

interface Project { id: number; project_number: string; name: string; status: string; estimated_cost: number; created_at: string; }
interface ProjectDetail extends Project {
  work_orders: { id: number; wo_number: string; status: string; created_at: string }[];
  dispatches: { id: number; dispatch_number: string; status: string; vehicle_number: string | null; created_at: string }[];
}
interface Quote { id: number; quote_number: string; project_name: string | null; status: string; grand_total: number; created_at: string; }

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-blue-100 text-blue-700", IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700", ON_HOLD: "bg-gray-100 text-gray-600",
  DRAFT: "bg-gray-100 text-gray-700", SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700",
  APPROVED: "bg-green-100 text-green-700", IN_TRANSIT: "bg-amber-100 text-amber-700",
  DELIVERED: "bg-green-100 text-green-700", PENDING: "bg-yellow-100 text-yellow-700",
};

export function ClientPortalPage() {
  const [token, setToken] = useState(localStorage.getItem("client_token") || "");
  const [clientName, setClientName] = useState(localStorage.getItem("client_name") || "");
  const [phone, setPhone] = useState("");
  const [logging, setLogging] = useState(false);

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<"projects" | "quotes">("projects");
  const [loaded, setLoaded] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || phone.length < 10) { toast.error("Enter valid phone number"); return; }
    setLogging(true);
    try {
      const res = await api.post("/client-portal/login", { phone });
      setToken(res.data.token);
      setClientName(res.data.client_name);
      localStorage.setItem("client_token", res.data.token);
      localStorage.setItem("client_name", res.data.client_name);
      toast.success(`Welcome, ${res.data.client_name}!`);
      fetchData(res.data.token);
    } catch {
      toast.error("No account found with this phone number");
    } finally { setLogging(false); }
  };

  const fetchData = async (t: string) => {
    try {
      const [pRes, qRes] = await Promise.all([
        api.get(`/client-portal/projects?token=${t}`),
        api.get(`/client-portal/quotations?token=${t}`),
      ]);
      setProjects(pRes.data);
      setQuotes(qRes.data);
      setLoaded(true);
    } catch {
      toast.error("Session expired — please login again");
      handleLogout();
    }
  };

  const handleProjectClick = async (id: number) => {
    try {
      const res = await api.get(`/client-portal/projects/${id}?token=${token}`);
      setSelectedProject(res.data);
    } catch { toast.error("Failed to load project"); }
  };

  const handleLogout = () => {
    setToken(""); setClientName("");
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_name");
    setProjects([]); setQuotes([]); setSelectedProject(null); setLoaded(false);
  };

  // Auto-load if token exists
  if (token && !loaded) { fetchData(token); }

  // Login Screen
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xl mb-3">DT</div>
            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-sm text-gray-500 mt-1">Track your projects, quotations & deliveries</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-700">Phone Number</label>
            <div className="mt-1 flex gap-2">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="text-lg" />
            </div>
            <Button onClick={handleLogin} disabled={logging} className="w-full mt-4">
              <Phone className="mr-2 h-4 w-4" /> {logging ? "Logging in..." : "Login with Phone"}
            </Button>
            <p className="text-[10px] text-gray-400 text-center mt-3">Enter the phone number registered with your projects</p>
          </div>
        </div>
      </div>
    );
  }

  // Portal Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">DT</div>
          <div>
            <p className="font-semibold text-sm">Welcome, {clientName}</p>
            <p className="text-[10px] text-indigo-200">Client Portal</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-indigo-200 hover:text-white">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        <button onClick={() => { setTab("projects"); setSelectedProject(null); }}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium ${tab === "projects" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border"}`}>
          <FolderKanban className="h-4 w-4" /> Projects ({projects.length})
        </button>
        <button onClick={() => { setTab("quotes"); setSelectedProject(null); }}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium ${tab === "quotes" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border"}`}>
          <FileText className="h-4 w-4" /> Quotations ({quotes.length})
        </button>
      </div>

      <div className="p-4">
        {/* Projects Tab */}
        {tab === "projects" && !selectedProject && (
          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No projects yet</div>
            ) : projects.map((p) => (
              <button key={p.id} onClick={() => handleProjectClick(p.id)}
                className="w-full text-left rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.project_number} · {formatDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || ""}`}>{p.status.replace("_", " ")}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                {p.estimated_cost > 0 && <p className="mt-1 text-sm font-medium text-indigo-700">{formatINR(p.estimated_cost)}</p>}
              </button>
            ))}
          </div>
        )}

        {/* Project Detail */}
        {tab === "projects" && selectedProject && (
          <div className="space-y-4">
            <button onClick={() => setSelectedProject(null)} className="text-sm text-indigo-600 hover:underline">← Back to Projects</button>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-lg font-bold text-gray-900">{selectedProject.name}</h2>
              <p className="text-xs text-gray-500">{selectedProject.project_number}</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[selectedProject.status] || ""}`}>{selectedProject.status.replace("_", " ")}</span>
            </div>

            {/* Work Orders */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Production Status</h3>
              {selectedProject.work_orders.length === 0 ? (
                <p className="text-xs text-gray-400">No work orders yet</p>
              ) : selectedProject.work_orders.map((wo) => (
                <div key={wo.id} className="flex items-center justify-between border-b last:border-0 py-2">
                  <div><p className="text-sm font-medium">{wo.wo_number}</p><p className="text-xs text-gray-500">{formatDate(wo.created_at)}</p></div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[wo.status] || ""}`}>{wo.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>

            {/* Dispatches */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><Truck className="h-4 w-4" /> Deliveries</h3>
              {selectedProject.dispatches.length === 0 ? (
                <p className="text-xs text-gray-400">No dispatches yet</p>
              ) : selectedProject.dispatches.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b last:border-0 py-2">
                  <div>
                    <p className="text-sm font-medium">{d.dispatch_number}</p>
                    <p className="text-xs text-gray-500">{d.vehicle_number || "No vehicle"} · {formatDate(d.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status] || ""}`}>{d.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quotations Tab */}
        {tab === "quotes" && (
          <div className="space-y-3">
            {quotes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No quotations yet</div>
            ) : quotes.map((q) => (
              <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{q.quote_number}</p>
                    <p className="text-xs text-gray-500">{q.project_name || "—"} · {formatDate(q.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status] || ""}`}>{q.status}</span>
                </div>
                <p className="mt-2 text-lg font-bold text-indigo-700">{formatINR(q.grand_total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
