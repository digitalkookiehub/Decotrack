import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Send } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR, formatNumber } from "../../lib/currency";
import { formatDateTime } from "../../lib/date";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [po, setPO] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchPO = () => {
    api.get(`/purchase-orders/${id}`).then((res) => {
      setPO(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchPO();
  }, [id]);

  if (loading || !po) return <LoadingSpinner />;

  const items = (po.items as Array<Record<string, unknown>>) || [];
  const history = (po.approval_history as Array<Record<string, unknown>>) || [];
  const status = po.status as string;

  const handleApprove = async () => {
    setActing(true);
    try {
      await api.post(`/purchase-orders/${id}/approve`, { comments: null });
      toast.success("Purchase order approved");
      fetchPO();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to approve";
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActing(true);
    try {
      await api.post(`/purchase-orders/${id}/reject`, { comments: rejectReason });
      toast.success("Purchase order rejected");
      setShowRejectForm(false);
      fetchPO();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to reject";
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const handleSubmit = async () => {
    setActing(true);
    try {
      await api.post(`/purchase-orders/${id}/submit`);
      toast.success("Submitted for approval");
      fetchPO();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to submit";
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const handleMarkSent = async () => {
    setActing(true);
    try {
      await api.post(`/purchase-orders/${id}/mark-sent`);
      toast.success("Marked as sent to vendor");
      fetchPO();
    } catch (err: unknown) {
      toast.error("Failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={po.po_number as string}
        subtitle={`Vendor: ${po.vendor_name ?? "—"}`}
        action={
          <div className="flex gap-2">
            {status === "DRAFT" && (
              <Button onClick={handleSubmit} disabled={acting}>
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            )}
            {status === "APPROVED" && (
              <Button onClick={handleMarkSent} disabled={acting}>
                Mark Sent to Vendor
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status + Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <StatusBadge status={status} />
                <span className="text-2xl font-bold">{formatINR(po.total_amount as number)}</span>
              </div>
              {po.rejection_reason && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4">
                  <p className="text-sm text-red-800">
                    <strong>Rejected:</strong> {po.rejection_reason as string}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Created by:</span>{" "}
                  <span className="font-medium">{po.creator_name as string}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>{" "}
                  <span>{formatDateTime(po.created_at as string)}</span>
                </div>
                {po.approver_name && (
                  <div>
                    <span className="text-gray-500">Approved by:</span>{" "}
                    <span className="font-medium">{po.approver_name as string}</span>
                  </div>
                )}
                {po.approved_at && (
                  <div>
                    <span className="text-gray-500">Approved:</span>{" "}
                    <span>{formatDateTime(po.approved_at as string)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Material</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Rate</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Last Rate</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.material_name as string}</div>
                        <div className="text-xs text-gray-400">{item.material_sku as string}</div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatNumber(item.quantity as number)} {item.material_unit as string}
                      </td>
                      <td className="px-4 py-2 text-right">{formatINR(item.rate as number)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatINR(item.amount as number)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{formatINR(item.last_purchase_rate as number)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{formatNumber(item.current_stock as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Admin Approval Actions */}
          {isAdmin() && status === "PENDING_APPROVAL" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-base text-amber-800">Approval Required</CardTitle>
              </CardHeader>
              <CardContent>
                {showRejectForm ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Reason for rejection (required)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={handleReject} disabled={acting}>
                        Confirm Reject
                      </Button>
                      <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} disabled={acting} className="bg-green-600 hover:bg-green-700">
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="destructive" onClick={() => setShowRejectForm(true)} disabled={acting}>
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — Approval History */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map((log, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            log.action === "APPROVED" || log.action === "AUTO_APPROVED"
                              ? "bg-green-500"
                              : log.action === "REJECTED"
                              ? "bg-red-500"
                              : "bg-gray-400"
                          }`}
                        />
                      </div>
                      <div className="text-xs">
                        <p className="font-medium text-gray-900">
                          {(log.action as string).replace(/_/g, " ")}
                        </p>
                        <p className="text-gray-500">
                          by {log.performer_name as string}
                        </p>
                        {log.comments && (
                          <p className="text-gray-600 mt-0.5 italic">"{log.comments as string}"</p>
                        )}
                        <p className="text-gray-400 mt-0.5">
                          {formatDateTime(log.created_at as string)}
                        </p>
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
