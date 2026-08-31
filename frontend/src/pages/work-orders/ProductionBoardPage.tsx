import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle, Circle, Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";

interface StageLog {
  id: number;
  stage_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ProductionUnit {
  id: number;
  wo_item_id: number;
  product_name: string;
  unit_number: number;
  total_units: number;
  current_stage: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  stage_logs: StageLog[];
}

export function ProductionBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [units, setUnits] = useState<ProductionUnit[]>([]);
  const [wo, setWO] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchData = () => {
    Promise.all([
      api.get(`/work-orders/${id}`),
      api.get(`/work-orders/${id}/production`),
    ]).then(([woRes, prodRes]) => {
      setWO(woRes.data);
      setUnits(prodRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  if (loading) return <LoadingSpinner />;

  // Get ALL production stages for a unit based on product name
  const getStagesForUnit = (unit: ProductionUnit): string[] => {
    const name = unit.product_name.toLowerCase();
    if (name.includes("kitchen base") || name.includes("kitchen wall"))
      return ["Cutting", "Edging", "Boring/Routing", "Carcass Assembly", "Shutter Prep", "Hardware Fitment", "QC"];
    if (name.includes("wardrobe"))
      return ["Cutting", "Edging", "Boring", "Assembly", "Finishing", "Hardware Fitment", "QC"];
    if (name.includes("tv unit"))
      return ["Cutting", "Edging", "Boring", "Assembly", "Finishing", "QC"];
    if (name.includes("vanity"))
      return ["Cutting", "Edging", "Waterproof Treatment", "Assembly", "Hardware Fitment", "QC"];
    if (name.includes("wall panel"))
      return ["Cutting", "Surface Prep", "Panel Mounting Prep", "Finishing", "QC"];
    if (name.includes("ceiling"))
      return ["Framework Prep", "Board Cutting", "Finishing", "QC"];
    if (name.includes("study") || name.includes("table"))
      return ["Cutting", "Edging", "Boring", "Assembly", "Finishing", "QC"];
    return ["Cutting", "Edging", "Assembly", "Finishing", "QC"];
  };

  const getStageStatus = (unit: ProductionUnit, stageName: string): "not_started" | "in_progress" | "completed" => {
    const log = unit.stage_logs.find((l) => l.stage_name === stageName);
    if (!log) return "not_started";
    if (log.status === "COMPLETED") return "completed";
    return "in_progress";
  };

  const handleStageAction = async (unitId: number, stageName: string, action: "start" | "complete") => {
    const key = `${unitId}-${stageName}-${action}`;
    setActing(key);
    try {
      await api.post(`/production/${unitId}/stage`, { stage_name: stageName, action });
      toast.success(`${stageName} ${action === "start" ? "started" : "completed"}`);
      fetchData();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setActing(null); }
  };

  // Group units by product
  const grouped: Record<string, ProductionUnit[]> = {};
  for (const unit of units) {
    const key = unit.product_name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(unit);
  }

  const woNumber = wo?.wo_number as string || "";
  const woStatus = wo?.status as string || "";

  return (
    <div>
      <PageHeader title={`Production — ${woNumber}`}
        subtitle={`Status: ${woStatus}`}
        action={<Button variant="outline" onClick={() => navigate(`/work-orders/${id}`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to WO</Button>} />

      {units.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-gray-600">No production units found.</p>
            <p className="text-sm text-gray-400">Production units are created when a work order is approved.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Progress Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Overall Progress</p>
                  <p className="text-2xl font-bold">
                    {units.filter((u) => u.status === "COMPLETED").length} / {units.length}
                    <span className="text-sm font-normal text-gray-500 ml-2">units completed</span>
                  </p>
                </div>
                <div className="h-16 w-16 rounded-full border-4 border-indigo-500 flex items-center justify-center">
                  <span className="text-lg font-bold text-indigo-600">
                    {Math.round((units.filter((u) => u.status === "COMPLETED").length / units.length) * 100)}%
                  </span>
                </div>
              </div>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${(units.filter((u) => u.status === "COMPLETED").length / units.length) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Units grouped by product */}
          {Object.entries(grouped).map(([productName, productUnits]) => (
            <Card key={productName}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{productName}</span>
                  <Badge variant="secondary">
                    {productUnits.filter((u) => u.status === "COMPLETED").length}/{productUnits.length} done
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {productUnits.map((unit) => {
                    const stages = getStagesForUnit(unit);
                    const isCompleted = unit.status === "COMPLETED";

                    return (
                      <div key={unit.id} className={`rounded-lg border p-4 ${isCompleted ? "border-green-200 bg-green-50/50" : "border-gray-200"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : unit.status === "IN_PROGRESS" ? (
                              <Clock className="h-5 w-5 text-blue-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-300" />
                            )}
                            <span className="font-medium">
                              Unit {unit.unit_number} of {unit.total_units}
                            </span>
                          </div>
                          <Badge variant={isCompleted ? "default" : "secondary"} className="text-[10px]">
                            {unit.status.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        {/* Stage Pipeline — full flow with arrows */}
                        <div className="flex flex-wrap items-center gap-1">
                          {stages.map((stage, stageIdx) => {
                            const stageStatus = getStageStatus(unit, stage);
                            const isActing = acting === `${unit.id}-${stage}-start` || acting === `${unit.id}-${stage}-complete`;

                            // Determine if this is the next actionable stage
                            const prevStage = stageIdx > 0 ? stages[stageIdx - 1] : null;
                            const prevStatus = prevStage ? getStageStatus(unit, prevStage) : "completed";
                            const isNextToStart = stageStatus === "not_started" && prevStatus === "completed" && !isCompleted;

                            return (
                              <div key={stage} className="flex items-center">
                                {stageIdx > 0 && (
                                  <span className={`mx-1 text-xs ${stageStatus === "completed" ? "text-green-400" : "text-gray-300"}`}>→</span>
                                )}
                                {stageStatus === "completed" ? (
                                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                    <CheckCircle className="h-3 w-3" />
                                    {stage}
                                  </div>
                                ) : stageStatus === "in_progress" ? (
                                  <button
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors shadow-sm animate-pulse"
                                    onClick={() => handleStageAction(unit.id, stage, "complete")}
                                    disabled={isActing}
                                  >
                                    <Clock className="h-3 w-3" />
                                    {stage}
                                    <span className="text-[10px] opacity-80">— tap to complete</span>
                                  </button>
                                ) : isNextToStart ? (
                                  <button
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium hover:bg-indigo-200 transition-colors border border-indigo-300 border-dashed"
                                    onClick={() => handleStageAction(unit.id, stage, "start")}
                                    disabled={isActing}
                                  >
                                    <Play className="h-3 w-3" />
                                    {stage}
                                    <span className="text-[10px] opacity-70">— start</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 text-xs">
                                    <Circle className="h-3 w-3" />
                                    {stage}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
