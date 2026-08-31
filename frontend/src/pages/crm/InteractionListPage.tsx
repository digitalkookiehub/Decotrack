import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, PhoneCall } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import api from "../../services/api";
import { formatDateTime } from "../../lib/date";
import type { Interaction, InteractionType } from "../../types";

const TYPES: InteractionType[] = [
  "INCOMING_CALL", "OUTGOING_CALL", "WHATSAPP", "EMAIL",
  "SITE_VISIT", "MEETING", "NOTE",
];

const TYPE_ICONS: Record<string, string> = {
  INCOMING_CALL: "text-green-600",
  OUTGOING_CALL: "text-blue-600",
  WHATSAPP: "text-emerald-600",
  EMAIL: "text-purple-600",
  SITE_VISIT: "text-amber-600",
  MEETING: "text-indigo-600",
  NOTE: "text-gray-600",
};

export function InteractionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const search = searchParams.get("search") || "";
  const typeFilter = searchParams.get("type") || "";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "30");
        if (search) params.set("search", search);
        if (typeFilter) params.set("interaction_type", typeFilter);
        const res = await api.get(`/crm/interactions?${params}`);
        setInteractions(res.data.items);
        setTotal(res.data.total);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page, search, typeFilter]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("search", value);
    else params.delete("search");
    setSearchParams(params);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Call Log"
        subtitle={`${total} interactions recorded`}
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by phone or summary..."
            className="pl-9"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.value) params.set("type", e.target.value);
            else params.delete("type");
            setSearchParams(params);
            setPage(1);
          }}
        >
          <option value="">All Types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : interactions.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="No interactions found"
          description="Interactions will appear here when calls are logged"
        />
      ) : (
        <>
          <div className="space-y-2">
            {interactions.map((i) => (
              <div
                key={i.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <PhoneCall className={`mt-0.5 h-5 w-5 ${TYPE_ICONS[i.interaction_type] || "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">
                      {i.interaction_type.replace("_", " ")}
                    </Badge>
                    {i.call_source === "ANDROID_APP" && (
                      <Badge variant="secondary" className="text-[10px]">AUTO</Badge>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDateTime(i.created_at)}
                    </span>
                  </div>
                  {i.summary && (
                    <p className="mt-1 text-sm text-gray-700">{i.summary}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    {i.phone_number && <span>{i.phone_number}</span>}
                    {i.duration_seconds != null && (
                      <span>
                        {Math.floor(i.duration_seconds / 60)}m {i.duration_seconds % 60}s
                      </span>
                    )}
                    <span>by {i.logger_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {total > 30 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Page {page} of {Math.ceil(total / 30)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
