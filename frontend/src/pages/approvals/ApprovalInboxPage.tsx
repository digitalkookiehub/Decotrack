import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, ShoppingCart, Factory, Truck, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatRelative } from "../../lib/date";
import api from "../../services/api";

interface PendingItem {
  type: string;
  id: number;
  number: string;
  amount: number;
  submitted_at: string | null;
  details: string;
}

export function ApprovalInboxPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    api.get("/approvals/?per_page=50")
      .then((res) => setItems(res.data.items))
      .catch(() => toast.error("Failed to load approvals"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "PURCHASE_ORDER": return ShoppingCart;
      case "WORK_ORDER": return Factory;
      case "DISPATCH": return Truck;
      default: return Clock;
    }
  };

  const getRoute = (type: string, id: number) => {
    switch (type) {
      case "PURCHASE_ORDER": return `/purchase-orders/${id}`;
      case "WORK_ORDER": return `/work-orders/${id}`;
      case "DISPATCH": return `/dispatches/${id}`;
      default: return "#";
    }
  };

  const getEndpoint = (type: string, id: number) => {
    switch (type) {
      case "PURCHASE_ORDER": return `/purchase-orders/${id}`;
      case "WORK_ORDER": return `/work-orders/${id}`;
      case "DISPATCH": return `/dispatches/${id}`;
      default: return "";
    }
  };

  const handleApprove = async (type: string, id: number) => {
    setActing(true);
    try {
      await api.post(`${getEndpoint(type, id)}/approve`, { comments: null });
      toast.success(`${type.replace(/_/g, " ")} approved`);
      fetchItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to approve";
      toast.error(msg);
    } finally { setActing(false); }
  };

  const handleReject = async (type: string, id: number) => {
    if (!rejectReason.trim()) { toast.error("Reason required"); return; }
    setActing(true);
    try {
      await api.post(`${getEndpoint(type, id)}/reject`, { comments: rejectReason });
      toast.success(`${type.replace(/_/g, " ")} rejected`);
      setRejectingId(null);
      setRejectReason("");
      fetchItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to reject";
      toast.error(msg);
    } finally { setActing(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Approval Inbox" subtitle={`${items.length} pending`} />

      {items.length === 0 ? (
        <EmptyState icon={Check} title="All caught up!" description="No pending approvals right now." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = getIcon(item.type);
            const key = `${item.type}-${item.id}`;
            const isRejecting = rejectingId === key;

            return (
              <Card key={key} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${
                      item.type === "PURCHASE_ORDER" ? "bg-blue-100 text-blue-600" :
                      item.type === "WORK_ORDER" ? "bg-purple-100 text-purple-600" :
                      "bg-green-100 text-green-600"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                        <span className="font-semibold text-gray-900">{item.number}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.details}</p>
                      {item.amount > 0 && (
                        <p className="text-lg font-bold text-gray-900 mt-1">{formatINR(item.amount)}</p>
                      )}
                      {item.submitted_at && (
                        <p className="text-xs text-gray-400 mt-1">Submitted {formatRelative(item.submitted_at)}</p>
                      )}

                      {isRejecting && (
                        <div className="mt-3 space-y-2">
                          <Textarea placeholder="Reason for rejection (required)..." value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)} />
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleReject(item.type, item.id)} disabled={acting}>
                              Confirm Reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!isRejecting && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(item.type, item.id)} disabled={acting}
                            className="bg-green-600 hover:bg-green-700">
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectingId(key)} disabled={acting}>
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => navigate(getRoute(item.type, item.id))}>
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
