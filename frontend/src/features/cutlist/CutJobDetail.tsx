import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Play, Download, Edit } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR } from "../../lib/currency";
import { formatDateTime } from "../../lib/date";
import api from "../../services/api";
import toast from "react-hot-toast";

interface Part {
  id: number; label: string; length: number; width: number; quantity: number;
  grain_locked: boolean; rotation_locked: boolean;
  edge_banding_l1: boolean; edge_banding_l2: boolean;
  edge_banding_w1: boolean; edge_banding_w2: boolean;
}

interface CutResultData {
  sheets_used: number; waste_percentage: number;
  material_efficiency_percentage: number; total_cost: number;
  waste_area: number; placements_json: { sheet: number; label: string }[];
  svg_data_json: string[];
}

interface CutJobData {
  id: number; name: string; material_id: number | null; material_name: string | null;
  sheet_width: number; sheet_height: number; blade_kerf: number;
  kerf_unit: string; cut_orientation: string; cutting_method: string;
  optimization_priority: string; units: string; status: string;
  parts: Part[]; result: CutResultData | null; created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  OPTIMIZED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

export function CutJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<CutJobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [activeSheet, setActiveSheet] = useState(1);
  const [error, setError] = useState("");

  const fetchJob = async () => {
    try {
      const res = await api.get(`/cutlist/jobs/${id}`);
      setJob(res.data);
    } catch { toast.error("Job not found"); navigate("/cutlist"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJob(); }, [id]);

  const handleOptimize = async () => {
    setOptimizing(true);
    setError("");
    try {
      await api.post(`/cutlist/jobs/${id}/optimize`);
      toast.success("Optimization complete!");
      setActiveSheet(1);
      fetchJob();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Optimization failed";
      setError(msg);
      toast.error(msg);
    } finally { setOptimizing(false); }
  };

  const handlePDF = async () => {
    try {
      const res = await api.get(`/cutlist/jobs/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CutJob-${job?.name?.replace(/\s+/g, "_") || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("PDF export failed"); }
  };

  if (loading || !job) return <LoadingSpinner />;

  const result = job.result;
  const svgs = result?.svg_data_json || [];
  const totalSheets = result?.sheets_used || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.name}
        subtitle={`${job.material_name || "No material"} — ${job.sheet_width}×${job.sheet_height} ${job.units.toLowerCase()}`}
        action={
          <div className="flex gap-2">
            {job.status === "PENDING" && (
              <Link to={`/cutlist/${id}/edit`}>
                <Button variant="outline"><Edit className="mr-2 h-4 w-4" />Edit</Button>
              </Link>
            )}
            {result && (
              <Button variant="outline" onClick={handlePDF}>
                <Download className="mr-2 h-4 w-4" />Export PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/cutlist")}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel: Job info + Parts + Optimize */}
        <div className="space-y-4">
          {/* Job Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[job.status] || ""}`}>
                {job.status}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Method</span><span>{job.cutting_method}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Orientation</span><span>{job.cut_orientation.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority</span><span>{job.optimization_priority.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Blade Kerf</span><span>{job.blade_kerf} {job.kerf_unit.toLowerCase()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{formatDateTime(job.created_at)}</span></div>
          </div>

          {/* Parts Table */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Parts ({job.parts.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500 font-medium">
                    <th className="pb-1 text-left">Label</th>
                    <th className="pb-1 text-right">L</th>
                    <th className="pb-1 text-right">W</th>
                    <th className="pb-1 text-right">Qty</th>
                    <th className="pb-1 text-center">G</th>
                  </tr>
                </thead>
                <tbody>
                  {job.parts.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1 font-medium">{p.label}</td>
                      <td className="py-1 text-right text-gray-600">{p.length}</td>
                      <td className="py-1 text-right text-gray-600">{p.width}</td>
                      <td className="py-1 text-right">{p.quantity}</td>
                      <td className="py-1 text-center">{p.grain_locked ? "🔒" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optimize Button */}
          <Button onClick={handleOptimize} disabled={optimizing} className="w-full">
            <Play className="mr-2 h-4 w-4" />
            {optimizing ? "Optimizing..." : "Run Optimization"}
          </Button>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <p className="text-gray-400 text-sm">Click "Run Optimization" to see results</p>
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Sheets Used" value={result.sheets_used} color="indigo" />
                <StatCard label="Efficiency" value={`${result.material_efficiency_percentage}%`}
                  color={result.material_efficiency_percentage >= 80 ? "green" : result.material_efficiency_percentage >= 60 ? "amber" : "red"} />
                <StatCard label="Waste Area" value={`${result.waste_area.toFixed(0)} mm²`} color="amber" />
                <StatCard label="Total Cost" value={formatINR(result.total_cost)} color="indigo" />
              </div>

              {/* Sheet Tabs */}
              {totalSheets > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: totalSheets }, (_, i) => i + 1).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSheet(s)}
                      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                        activeSheet === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Sheet {s}
                    </button>
                  ))}
                </div>
              )}

              {/* SVG Diagram */}
              {svgs[activeSheet - 1] && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div dangerouslySetInnerHTML={{ __html: svgs[activeSheet - 1] }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const bg: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-200", green: "bg-green-50 border-green-200",
    amber: "bg-amber-50 border-amber-200", red: "bg-red-50 border-red-200",
  };
  const text: Record<string, string> = {
    indigo: "text-indigo-700", green: "text-green-700",
    amber: "text-amber-700", red: "text-red-700",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${bg[color] || bg.indigo}`}>
      <p className={`text-xl font-bold ${text[color] || text.indigo}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}
