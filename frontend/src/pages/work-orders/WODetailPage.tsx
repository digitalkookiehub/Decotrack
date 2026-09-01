import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Check, X, Send, Factory, Scissors } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR } from "../../lib/currency";
import { formatDateTime } from "../../lib/date";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export function WODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [wo, setWO] = useState<Record<string, unknown> | null>(null);
  const [materialCheck, setMaterialCheck] = useState<Array<Record<string, unknown>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchWO = () => {
    api.get(`/work-orders/${id}`).then((res) => { setWO(res.data); setLoading(false); });
  };

  useEffect(() => {
    fetchWO();
    api.get(`/work-orders/${id}/material-check`).then((res) => setMaterialCheck(res.data)).catch(() => {});
    api.get(`/cutting/orders?search=WO-${id}&per_page=50`).catch(() => {});
  }, [id]);

  const hasMaterialShortage = materialCheck !== null && materialCheck.some((c) => !(c.sufficient as boolean));

  if (loading || !wo) return <LoadingSpinner />;

  const status = wo.status as string;
  const items = (wo.items as Array<Record<string, unknown>>) || [];
  const history = (wo.approval_history as Array<Record<string, unknown>>) || [];

  const handleSubmit = async () => {
    setActing(true);
    try { await api.post(`/work-orders/${id}/submit`); toast.success("Submitted for approval"); fetchWO(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleApprove = async () => {
    setActing(true);
    try { await api.post(`/work-orders/${id}/approve`, { comments: null }); toast.success("Work order approved — materials issued"); fetchWO(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Reason required"); return; }
    setActing(true);
    try { await api.post(`/work-orders/${id}/reject`, { comments: rejectReason }); toast.success("Rejected"); setShowRejectForm(false); fetchWO(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  return (
    <div>
      <PageHeader title={wo.wo_number as string}
        subtitle={`Project: ${wo.project_name ?? "—"}`}
        action={
          <div className="flex gap-2">
            {status === "DRAFT" && (
              <Button onClick={handleSubmit} disabled={acting || hasMaterialShortage}
                title={hasMaterialShortage ? "Cannot submit — insufficient materials" : ""}>
                <Send className="h-4 w-4 mr-2" />Submit for Approval
              </Button>
            )}
            {["APPROVED", "IN_PROGRESS"].includes(status) && (
              <>
                <Link to={`/cut-planner?wo=${id}&wo_number=${wo.wo_number}`}>
                  <Button variant="outline"><Scissors className="h-4 w-4 mr-2" />Create Cut Plan</Button>
                </Link>
                <Link to={`/work-orders/${id}/production`}>
                  <Button><Factory className="h-4 w-4 mr-2" />Production Board</Button>
                </Link>
              </>
            )}
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Status + Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <StatusBadge status={status} />
                <span className="text-xl font-bold">{formatINR(wo.estimated_material_cost as number)}</span>
              </div>
              {Boolean(wo.rejection_reason) && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4">
                  <p className="text-sm text-red-800"><strong>Rejected:</strong> {wo.rejection_reason as string}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Created by:</span> <span className="font-medium">{wo.creator_name as string}</span></div>
                <div><span className="text-gray-500">Created:</span> <span>{formatDateTime(wo.created_at as string)}</span></div>
                {Boolean(wo.approver_name) && <div><span className="text-gray-500">Approved by:</span> <span className="font-medium">{wo.approver_name as string}</span></div>}
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader><CardTitle className="text-base">Products ({items.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Quantity</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Completed</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-medium">{item.product_name as string}</td>
                      <td className="px-4 py-2 text-right">{item.quantity as number}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={(item.completed_count as number) >= (item.quantity as number) ? "text-green-600 font-semibold" : ""}>
                          {item.completed_count as number}
                        </span>
                        <span className="text-gray-400"> / {item.quantity as number}</span>
                      </td>
                      <td className="px-4 py-2 text-center"><StatusBadge status={item.status as string} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Material Check */}
          {materialCheck && materialCheck.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Material Requirements</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Material</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Required</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Available</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {materialCheck.map((c, idx) => (
                      <tr key={idx} className={!(c.sufficient as boolean) ? "bg-red-50" : ""}>
                        <td className="px-4 py-2 font-medium">{c.material_name as string}</td>
                        <td className="px-4 py-2 text-right">{c.required as number} {c.unit as string}</td>
                        <td className="px-4 py-2 text-right">{c.available as number} {c.unit as string}</td>
                        <td className="px-4 py-2 text-center">
                          {c.sufficient ? (
                            <Check className="h-4 w-4 text-green-500 inline" />
                          ) : (
                            <X className="h-4 w-4 text-red-500 inline" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              {materialCheck.some((c) => !(c.sufficient as boolean)) && (
                <div className="p-3 bg-red-50 border-t border-red-200 text-sm text-red-700 font-medium">
                  Cannot submit — insufficient materials. Purchase the short materials first.
                </div>
              )}
              </CardContent>
            </Card>
          )}

          {/* Admin Approval */}
          {isAdmin() && status === "PENDING_APPROVAL" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader><CardTitle className="text-base text-amber-800">Approval Required</CardTitle></CardHeader>
              <CardContent>
                {showRejectForm ? (
                  <div className="space-y-3">
                    <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={handleReject} disabled={acting}>Confirm Reject</Button>
                      <Button variant="outline" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} disabled={acting} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-2" />Approve & Issue Materials</Button>
                    <Button variant="destructive" onClick={() => setShowRejectForm(true)} disabled={acting}><X className="h-4 w-4 mr-2" />Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map((log, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`h-2 w-2 rounded-full ${
                          log.action === "APPROVED" || log.action === "AUTO_APPROVED" ? "bg-green-500" :
                          log.action === "REJECTED" ? "bg-red-500" : "bg-gray-400"
                        }`} />
                      </div>
                      <div className="text-xs">
                        <p className="font-medium">{(log.action as string).replace(/_/g, " ")}</p>
                        <p className="text-gray-500">by {log.performer_name as string}</p>
                        {Boolean(log.comments) && <p className="text-gray-600 italic">"{log.comments as string}"</p>}
                        <p className="text-gray-400">{formatDateTime(log.created_at as string)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
