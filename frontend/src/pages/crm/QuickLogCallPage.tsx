import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Search, UserPlus, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import api from "../../services/api";
import { formatRelative } from "../../lib/date";
import toast from "react-hot-toast";
import type { InteractionType, Interaction } from "../../types";

const INTERACTION_TYPES: InteractionType[] = [
  "INCOMING_CALL", "OUTGOING_CALL", "WHATSAPP", "EMAIL",
  "SITE_VISIT", "MEETING", "NOTE",
];

interface LookupResult {
  found: boolean;
  match_type: string | null;
  client: { id: number; name: string; phone: string; email: string | null; city: string | null } | null;
  lead: { id: number; lead_number: string; name: string; phone: string; status: string } | null;
  recent_interactions: Interaction[];
}

export function QuickLogCallPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({
    interaction_type: "INCOMING_CALL" as InteractionType,
    duration_seconds: "",
    summary: "",
  });
  const [saving, setSaving] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");

  const handleLookup = async () => {
    if (phone.length < 5) {
      toast.error("Enter at least 5 digits");
      return;
    }
    setSearching(true);
    setLookup(null);
    try {
      const res = await api.get(`/crm/lookup?phone=${encodeURIComponent(phone)}`);
      setLookup(res.data);
      if (!res.data.found) {
        setShowNewLead(true);
      }
    } catch {
      // handled
    } finally {
      setSearching(false);
    }
  };

  const handleLogCall = async () => {
    if (!lookup) return;
    setSaving(true);
    try {
      await api.post("/crm/interactions", {
        lead_id: lookup.lead?.id || null,
        client_id: lookup.client?.id || null,
        interaction_type: form.interaction_type,
        phone_number: phone,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        summary: form.summary || null,
      });
      toast.success("Call logged!");
      navigate("/crm");
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLeadAndLog = async () => {
    if (!newLeadName.trim()) {
      toast.error("Enter a name for the lead");
      return;
    }
    setSaving(true);
    try {
      // Create lead first
      const leadRes = await api.post("/crm/leads", {
        name: newLeadName,
        phone: phone,
        source: form.interaction_type === "INCOMING_CALL" ? "INCOMING_CALL" : "OUTGOING_CALL",
      });
      // Then log the interaction
      await api.post("/crm/interactions", {
        lead_id: leadRes.data.id,
        interaction_type: form.interaction_type,
        phone_number: phone,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        summary: form.summary || null,
      });
      toast.success("Lead created and call logged!");
      navigate(`/crm/leads/${leadRes.data.id}`);
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Quick Log Call"
        subtitle="Enter phone number to find client/lead and log the call"
        action={
          <Button variant="outline" onClick={() => navigate("/crm")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      {/* Phone Lookup */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <label className="text-sm font-medium text-gray-700">Phone Number</label>
        <div className="mt-1 flex gap-2">
          <Input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setLookup(null);
              setShowNewLead(false);
            }}
            placeholder="+91 98765 43210"
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="text-lg"
          />
          <Button onClick={handleLookup} disabled={searching}>
            <Search className="mr-2 h-4 w-4" />
            {searching ? "Searching..." : "Lookup"}
          </Button>
        </div>

        {/* Lookup Result */}
        {lookup && (
          <div className="mt-4">
            {lookup.found ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">
                  Found: {lookup.match_type === "client" ? "Existing Client" : "Existing Lead"}
                </p>
                <div className="mt-2">
                  <p className="text-lg font-semibold text-gray-900">
                    {lookup.client?.name || lookup.lead?.name}
                  </p>
                  {lookup.lead && (
                    <p className="text-sm text-gray-600">
                      {lookup.lead.lead_number} — Status: {lookup.lead.status}
                    </p>
                  )}
                  {lookup.client?.city && (
                    <p className="text-sm text-gray-600">{lookup.client.city}</p>
                  )}
                </div>

                {/* Recent interactions */}
                {lookup.recent_interactions.length > 0 && (
                  <div className="mt-3 border-t border-green-200 pt-3">
                    <p className="text-xs font-medium text-green-700 mb-1">Recent Interactions</p>
                    {lookup.recent_interactions.map((i) => (
                      <div key={i.id} className="text-xs text-gray-600 py-0.5">
                        {i.interaction_type.replace("_", " ")} — {i.summary || "No notes"} ({formatRelative(i.created_at)})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  No client or lead found for this number
                </p>
                <p className="mt-1 text-xs text-amber-600">
                  Create a new lead below to track this contact
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Call Form */}
      {(lookup?.found || showNewLead) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            <Phone className="inline mr-2 h-4 w-4" />
            Log Call Details
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Call Type</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.interaction_type}
                onChange={(e) => setForm({ ...form, interaction_type: e.target.value as InteractionType })}
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Duration (seconds)</label>
              <Input
                type="number"
                value={form.duration_seconds}
                onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
                placeholder="e.g. 120"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Summary / Notes</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="What was discussed..."
            />
          </div>

          {/* New Lead Name (if not found) */}
          {showNewLead && !lookup?.found && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                <p className="text-sm font-medium text-indigo-800">Create New Lead</p>
              </div>
              <Input
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/crm")}>
              Cancel
            </Button>
            {lookup?.found ? (
              <Button onClick={handleLogCall} disabled={saving}>
                {saving ? "Logging..." : "Log Call"}
              </Button>
            ) : (
              <Button onClick={handleCreateLeadAndLog} disabled={saving}>
                {saving ? "Creating..." : "Create Lead & Log Call"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
