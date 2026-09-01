import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Check, X, Send, Camera, Truck, MapPin, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatDateTime } from "../../lib/date";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export function DispatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [dispatch, setDispatch] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchDispatch = () => {
    api.get(`/dispatches/${id}`).then((res) => { setDispatch(res.data); setLoading(false); });
  };

  useEffect(() => { fetchDispatch(); }, [id]);

  if (loading || !dispatch) return <LoadingSpinner />;

  const status = dispatch.status as string;
  const items = (dispatch.items as Array<Record<string, unknown>>) || [];
  const photos = (dispatch.photos as Array<Record<string, unknown>>) || [];
  const history = (dispatch.approval_history as Array<Record<string, unknown>>) || [];

  const factoryPhotos = photos.filter((p) => p.checkpoint === "FACTORY");
  const sitePhotos = photos.filter((p) => p.checkpoint === "SITE");

  const handleSubmit = async () => {
    setActing(true);
    try { await api.post(`/dispatches/${id}/submit`); toast.success("Submitted for approval"); fetchDispatch(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleApprove = async () => {
    setActing(true);
    try { await api.post(`/dispatches/${id}/approve`, { comments: null }); toast.success("Dispatch approved"); fetchDispatch(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Reason required"); return; }
    setActing(true);
    try { await api.post(`/dispatches/${id}/reject`, { comments: rejectReason }); toast.success("Rejected"); setShowRejectForm(false); fetchDispatch(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleConfirmLoading = async () => {
    setActing(true);
    try { await api.post(`/dispatches/${id}/confirm-loading`); toast.success("Loading confirmed — dispatch in transit"); fetchDispatch(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleConfirmDelivery = async () => {
    setActing(true);
    try { await api.post(`/dispatches/${id}/confirm-delivery`); toast.success("Delivery confirmed"); fetchDispatch(); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
    finally { setActing(false); }
  };

  const handleRegenerateLink = async () => {
    try {
      const res = await api.post(`/dispatches/${id}/regenerate-link`);
      const url = res.data.delivery_url;
      await navigator.clipboard.writeText(url);
      toast.success("Delivery link copied to clipboard");
      fetchDispatch();
    } catch { toast.error("Failed to regenerate link"); }
  };

  // Status stepper
  const allStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "LOADING_VERIFICATION", "IN_TRANSIT", "DELIVERY_VERIFICATION", "DELIVERED"];
  const currentIdx = allStatuses.indexOf(status);

  return (
    <div>
      <PageHeader title={dispatch.dispatch_number as string}
        subtitle={`Project: ${dispatch.project_name ?? "—"}`}
        action={
          <div className="flex gap-2">
            {status === "DRAFT" && <Button onClick={handleSubmit} disabled={acting}><Send className="h-4 w-4 mr-2" />Submit for Approval</Button>}
            {status === "IN_TRANSIT" && (
              <Button variant="outline" onClick={handleRegenerateLink}><Copy className="h-4 w-4 mr-2" />Copy Delivery Link</Button>
            )}
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </div>
        } />

      {/* Status Stepper */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between overflow-x-auto">
            {allStatuses.map((s, idx) => {
              const isActive = idx === currentIdx;
              const isDone = idx < currentIdx;
              const isRejected = status === "REJECTED";
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      isDone ? "bg-green-500 text-white" :
                      isActive ? (isRejected ? "bg-red-500 text-white" : "bg-indigo-500 text-white") :
                      "bg-gray-200 text-gray-500"
                    }`}>
                      {isDone ? <Check className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className={`mt-1 text-[10px] text-center ${isActive ? "font-semibold text-gray-900" : "text-gray-400"}`}>
                      {s.replace(/_/g, " ")}
                    </span>
                  </div>
                  {idx < allStatuses.length - 1 && (
                    <div className={`h-0.5 w-8 mx-1 ${isDone ? "bg-green-500" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Rejection banner */}
          {Boolean(dispatch.rejection_reason) && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800"><strong>Rejected:</strong> {dispatch.rejection_reason as string}</p>
            </div>
          )}

          {/* Dispatch Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dispatch Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Vehicle:</span> <span className="font-medium">{(dispatch.vehicle_number as string) || "—"}</span></div>
                <div><span className="text-gray-500">Driver:</span> <span className="font-medium">{(dispatch.driver_name as string) || "—"}</span></div>
                <div><span className="text-gray-500">Driver Phone:</span> <span>{(dispatch.driver_phone as string) || "—"}</span></div>
                <div><span className="text-gray-500">Delivery City:</span> <span>{(dispatch.delivery_city as string) || "—"}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Address:</span> <span>{(dispatch.delivery_address as string) || "—"}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader><CardTitle className="text-base">Items ({items.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Factory Verified</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Received at Site</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const deliveredQty = item.delivered_quantity as number | null;
                    const siteVerified = item.site_verified as boolean;
                    const shortfall = siteVerified && deliveredQty !== null && deliveredQty < (item.quantity as number);
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-medium">{item.product_name as string}</td>
                        <td className="px-4 py-2 text-right">{item.quantity as number}</td>
                        <td className="px-4 py-2 text-center">
                          {item.factory_verified ? (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">Verified</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {!siteVerified ? (
                            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                          ) : shortfall ? (
                            <Badge className="bg-amber-100 text-amber-800 text-[10px]">Short: {deliveredQty}/{item.quantity as number}</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">Full: {deliveredQty}/{item.quantity as number}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Loading Verification Action */}
          {status === "LOADING_VERIFICATION" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader><CardTitle className="text-base text-blue-800">Loading Verification</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700 mb-3">
                  All items must be factory-verified with photos before loading can be confirmed.
                  Use the loading verification screen to upload photos for each item.
                </p>
                <div className="flex gap-2">
                  <Link to={`/dispatches/${id}/loading`}>
                    <Button><Camera className="h-4 w-4 mr-2" />Open Loading Verification</Button>
                  </Link>
                  <Button variant="outline" onClick={handleConfirmLoading} disabled={acting}>
                    <Check className="h-4 w-4 mr-2" />Confirm Loading
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery Confirmation Action */}
          {status === "DELIVERY_VERIFICATION" && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader><CardTitle className="text-base text-green-800">Delivery Verification</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-green-700 mb-3">Driver has uploaded delivery photos. Review them and confirm delivery.</p>
                <Button onClick={handleConfirmDelivery} disabled={acting} className="bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4 mr-2" />Confirm Delivery
                </Button>
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
                    <Button onClick={handleApprove} disabled={acting} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-2" />Approve</Button>
                    <Button variant="destructive" onClick={() => setShowRejectForm(true)} disabled={acting}><X className="h-4 w-4 mr-2" />Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Photo Timeline — always show if dispatch is past approval */}
          {["LOADING_VERIFICATION", "IN_TRANSIT", "DELIVERY_VERIFICATION", "DELIVERED"].includes(status) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Photo Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Camera className="h-4 w-4" /> Factory Loading ({factoryPhotos.length})
                    </h4>
                    {factoryPhotos.length === 0 ? (
                      <p className="text-xs text-gray-400">No factory photos yet</p>
                    ) : (
                      <div className="space-y-3">
                        {factoryPhotos.map((p, i) => {
                          const imgUrl = `${p.storage_url as string}`;
                          return (
                            <div key={i} className="rounded border border-gray-200 overflow-hidden">
                              <img src={imgUrl} alt={p.item_reference as string} className="w-full h-40 object-cover bg-gray-100" />
                              <div className="p-2 text-xs">
                                <p className="font-medium">{p.item_reference as string}</p>
                                <p className="text-gray-500">{formatDateTime(p.captured_at as string)}</p>
                                {Boolean(p.gps_available) && <p className="text-gray-400"><MapPin className="h-3 w-3 inline mr-1" />{Number(p.gps_lat).toFixed(4)}, {Number(p.gps_lng).toFixed(4)}</p>}
                                {Boolean(p.notes) && <p className="text-gray-600 italic mt-1">{p.notes as string}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Site Delivery ({sitePhotos.length})
                    </h4>
                    {!dispatch.delivery_geocoded && sitePhotos.length > 0 && (
                      <p className="text-[11px] text-gray-400 mb-2">Location check unavailable — couldn't resolve the delivery address to coordinates.</p>
                    )}
                    {sitePhotos.length === 0 ? (
                      <p className="text-xs text-gray-400">No delivery photos yet</p>
                    ) : (
                      <div className="space-y-3">
                        {sitePhotos.map((p, i) => {
                          const imgUrl = `${p.storage_url as string}`;
                          const distanceM = p.distance_m as number | null;
                          const flagged = p.flagged as boolean;
                          return (
                            <div key={i} className="rounded border border-gray-200 overflow-hidden">
                              <img src={imgUrl} alt={p.item_reference as string} className="w-full h-40 object-cover bg-gray-100" />
                              <div className="p-2 text-xs">
                                <p className="font-medium">{p.item_reference as string}</p>
                                <p className="text-gray-500">{formatDateTime(p.captured_at as string)}</p>
                                {Boolean(p.gps_available) && <p className="text-gray-400"><MapPin className="h-3 w-3 inline mr-1" />{Number(p.gps_lat).toFixed(4)}, {Number(p.gps_lng).toFixed(4)}</p>}
                                {flagged && (
                                  <p className="text-amber-600 font-medium mt-1">⚠ {Math.round(distanceM as number)}m from delivery address</p>
                                )}
                                {distanceM !== null && !flagged && (
                                  <p className="text-green-600 mt-1">✓ Near delivery address ({Math.round(distanceM)}m)</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Delivery Link */}
          {Boolean(dispatch.delivery_token) && ["IN_TRANSIT", "DELIVERY_VERIFICATION"].includes(status) && (
            <Card className="border-indigo-200">
              <CardHeader><CardTitle className="text-base">Driver Delivery Link</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded p-2 text-xs font-mono break-all mb-2">
                  /delivery/{dispatch.delivery_token as string}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => {
                  const url = `${window.location.origin}/delivery/${dispatch.delivery_token as string}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Link copied!");
                }}>
                  <Copy className="h-3 w-3 mr-1" />Copy Link
                </Button>
                {Boolean(dispatch.token_expires_at) && (
                  <p className="text-[10px] text-gray-400 mt-2">Expires: {formatDateTime(dispatch.token_expires_at as string)}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Approval History */}
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

          {/* Challan */}
          {Boolean(dispatch.challan_url) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Delivery Challan</CardTitle></CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => window.open(dispatch.challan_url as string)}>
                  Download Challan PDF
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
