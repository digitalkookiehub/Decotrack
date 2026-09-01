import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatRelative } from "../../lib/date";
import api from "../../services/api";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    api.get("/notifications/?per_page=50")
      .then((res) => { setNotifications(res.data.items); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markRead = async (id: number) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await api.put("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All marked as read");
  };

  const getEntityLink = (n: Notification): string | null => {
    if (!n.entity_type || !n.entity_id) return null;
    switch (n.entity_type) {
      case "PURCHASE_ORDER": return `/purchase-orders/${n.entity_id}`;
      case "WORK_ORDER": return `/work-orders/${n.entity_id}`;
      case "DISPATCH": return `/dispatches/${n.entity_id}`;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "APPROVAL_REQUEST": return <Badge className="bg-amber-100 text-amber-700 text-[10px]">Approval</Badge>;
      case "APPROVAL_REMINDER": return <Badge className="bg-orange-100 text-orange-700 text-[10px]">Reminder</Badge>;
      case "REORDER_ALERT": return <Badge className="bg-red-100 text-red-700 text-[10px]">Reorder</Badge>;
      case "DELIVERY_COMPLETE": return <Badge className="bg-green-100 text-green-700 text-[10px]">Delivery</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{type}</Badge>;
    }
  };

  if (loading) return <LoadingSpinner />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread`}
        action={unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />Mark All Read
          </Button>
        ) : undefined} />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const link = getEntityLink(n);
            return (
              <Card key={n.id} className={n.is_read ? "opacity-60" : "border-l-4 border-l-indigo-500"}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeBadge(n.type)}
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatRelative(n.created_at)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <Button variant="ghost" size="sm" onClick={() => markRead(n.id)} title="Mark as read">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {link && (
                        <Button variant="outline" size="sm" onClick={() => navigate(link)}>View</Button>
                      )}
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
