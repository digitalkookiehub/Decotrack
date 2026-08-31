import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PhoneCall,
  UserPlus,
  CalendarClock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Phone,
} from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { Badge } from "../../components/ui/badge";
import api from "../../services/api";
import { formatINR } from "../../lib/currency";
import { formatRelative } from "../../lib/date";
import type { CRMStats, Lead, FollowupItem, Interaction } from "../../types";

const PIPELINE_STAGES: { key: string; label: string; color: string }[] = [
  { key: "NEW", label: "New", color: "bg-blue-500" },
  { key: "CONTACTED", label: "Contacted", color: "bg-indigo-500" },
  { key: "SITE_VISIT", label: "Site Visit", color: "bg-purple-500" },
  { key: "MEASUREMENT", label: "Measurement", color: "bg-amber-500" },
  { key: "QUOTATION_SENT", label: "Quotation", color: "bg-orange-500" },
  { key: "NEGOTIATION", label: "Negotiation", color: "bg-pink-500" },
  { key: "WON", label: "Won", color: "bg-green-500" },
  { key: "LOST", label: "Lost", color: "bg-gray-400" },
];

export function CRMDashboardPage() {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [todayFollowups, setTodayFollowups] = useState<FollowupItem[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, leadsRes, followupsRes, interactionsRes] = await Promise.all([
          api.get("/crm/stats"),
          api.get("/crm/leads?per_page=5"),
          api.get("/crm/followups?filter=pending&per_page=5"),
          api.get("/crm/interactions?per_page=10"),
        ]);
        setStats(statsRes.data);
        setRecentLeads(leadsRes.data.items);
        setTodayFollowups(followupsRes.data.items);
        setRecentInteractions(interactionsRes.data.items);
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Loading CRM..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Dashboard"
        subtitle="Leads, calls, and follow-ups at a glance"
        action={
          <div className="flex gap-2">
            <Link
              to="/crm/quick-log"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Phone className="h-4 w-4" />
              Log Call
            </Link>
            <Link
              to="/crm/leads?new=true"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" />
              New Lead
            </Link>
          </div>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Leads"
            value={stats.total_leads}
            icon={<UserPlus className="h-5 w-5 text-indigo-600" />}
          />
          <StatCard
            label="Today's Follow-ups"
            value={stats.todays_followups}
            icon={<CalendarClock className="h-5 w-5 text-amber-600" />}
          />
          <StatCard
            label="Overdue Follow-ups"
            value={stats.overdue_followups}
            icon={<AlertCircle className="h-5 w-5 text-red-600" />}
            highlight={stats.overdue_followups > 0}
          />
          <StatCard
            label="Won Value"
            value={formatINR(stats.won_value)}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          />
        </div>
      )}

      {/* Pipeline */}
      {stats && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Lead Pipeline</h2>
            <Link
              to="/crm/leads"
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              View all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
            {PIPELINE_STAGES.map((stage) => (
              <Link
                key={stage.key}
                to={`/crm/leads?status=${stage.key}`}
                className="rounded-lg border border-gray-100 p-3 text-center hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                <div className={`mx-auto mb-1 h-2 w-2 rounded-full ${stage.color}`} />
                <div className="text-lg font-bold text-gray-900">
                  {stats.pipeline[stage.key] || 0}
                </div>
                <div className="text-[11px] text-gray-500">{stage.label}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Follow-ups */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Pending Follow-ups</h2>
            <Link
              to="/crm/followups"
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              View all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          {todayFollowups.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No pending follow-ups</p>
          ) : (
            <div className="space-y-2">
              {todayFollowups.map((f) => {
                const isOverdue = new Date(f.scheduled_at) < new Date();
                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      isOverdue ? "border-red-200 bg-red-50" : "border-gray-100"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {f.lead_name || f.client_name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500">{f.notes}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isOverdue ? "destructive" : "secondary"}>
                        {isOverdue ? "Overdue" : formatRelative(f.scheduled_at)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Interactions */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Interactions</h2>
            <Link
              to="/crm/interactions"
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              View all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          {recentInteractions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No recent interactions</p>
          ) : (
            <div className="space-y-2">
              {recentInteractions.slice(0, 5).map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-3 rounded-md border border-gray-100 px-3 py-2"
                >
                  <PhoneCall className="h-4 w-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {i.phone_number || "No number"} — {i.interaction_type.replace("_", " ")}
                    </p>
                    {i.summary && (
                      <p className="text-xs text-gray-500 truncate">{i.summary}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatRelative(i.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent Leads</h2>
          <Link
            to="/crm/leads"
            className="text-xs text-indigo-600 hover:text-indigo-700"
          >
            View all <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No leads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-4">Lead #</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Phone</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        to={`/crm/leads/${lead.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {lead.lead_number}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-900">{lead.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{lead.phone || "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">
                        {lead.source.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="py-2 text-gray-600">
                      {lead.estimated_value ? formatINR(lead.estimated_value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {icon}
      </div>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    CONTACTED: "bg-indigo-100 text-indigo-700",
    SITE_VISIT: "bg-purple-100 text-purple-700",
    MEASUREMENT: "bg-amber-100 text-amber-700",
    QUOTATION_SENT: "bg-orange-100 text-orange-700",
    NEGOTIATION: "bg-pink-100 text-pink-700",
    WON: "bg-green-100 text-green-700",
    LOST: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
