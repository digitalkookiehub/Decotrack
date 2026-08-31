import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import api from "../../services/api";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import { LeadStatusBadge } from "./CRMDashboardPage";
import type { Lead, LeadSource, LeadStatus } from "../../types";
import toast from "react-hot-toast";

const SOURCES: LeadSource[] = [
  "INCOMING_CALL", "OUTGOING_CALL", "WHATSAPP", "WALK_IN",
  "REFERRAL", "WEBSITE", "INSTAGRAM", "OTHER",
];

const STATUSES: LeadStatus[] = [
  "NEW", "CONTACTED", "SITE_VISIT", "MEASUREMENT",
  "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST",
];

export function LeadListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "true");

  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const sourceFilter = searchParams.get("source") || "";

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "20");
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (sourceFilter) params.set("source", sourceFilter);
        const res = await api.get(`/crm/leads?${params}`);
        setLeads(res.data.items);
        setTotal(res.data.total);
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, [page, search, statusFilter, sourceFilter]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("search", value);
    else params.delete("search");
    params.delete("new");
    setSearchParams(params);
    setPage(1);
  };

  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        subtitle={`${total} total leads`}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Lead
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, phone, or lead #..."
            className="pl-9"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => handleFilter("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={sourceFilter}
          onChange={(e) => handleFilter("source", e.target.value)}
        >
          <option value="">All Sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No leads found"
          description="Create your first lead to start tracking your sales pipeline"
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Lead #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/crm/leads/${lead.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {lead.lead_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{lead.source.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.assignee_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {lead.estimated_value ? formatINR(lead.estimated_value) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.ceil(total / 20)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Lead Dialog */}
      <CreateLeadDialog open={showCreate} onClose={() => {
        setShowCreate(false);
        const params = new URLSearchParams(searchParams);
        params.delete("new");
        setSearchParams(params);
      }} onCreated={() => {
        setShowCreate(false);
        setPage(1);
        // re-fetch
        window.location.reload();
      }} />
    </div>
  );
}

function CreateLeadDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    source: "INCOMING_CALL" as LeadSource,
    estimated_value: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/crm/leads", {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        city: form.city || null,
        source: form.source,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        notes: form.notes || null,
      });
      toast.success("Lead created");
      onCreated();
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">City</label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Source</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Estimated Value</label>
            <Input
              type="number"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
              placeholder="e.g. 500000"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Initial conversation notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
