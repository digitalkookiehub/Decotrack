import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserCheck,
  PhoneCall,
  Plus,
  CheckCircle,
  Sparkles,
  Copy,
  Camera,
  Ruler,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { LeadStatusBadge } from "./CRMDashboardPage";
import api from "../../services/api";
import { formatINR } from "../../lib/currency";
import { formatDateTime, formatRelative } from "../../lib/date";
import toast from "react-hot-toast";
import type { LeadDetail, LeadStatus, InteractionType } from "../../types";

const STATUSES: LeadStatus[] = [
  "NEW", "CONTACTED", "SITE_VISIT", "MEASUREMENT",
  "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST",
];

const INTERACTION_TYPES: InteractionType[] = [
  "INCOMING_CALL", "OUTGOING_CALL", "WHATSAPP", "EMAIL",
  "SITE_VISIT", "MEETING", "NOTE",
];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<LeadDetail>>({});
  const [showInteraction, setShowInteraction] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [scanningMeasurement, setScanningMeasurement] = useState(false);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({ room: "", length_mm: "", width_mm: "", height_mm: "", notes: "" });
  const measurementScanRef = useRef<HTMLInputElement>(null);

  const fetchLead = async () => {
    try {
      const res = await api.get(`/crm/leads/${id}`);
      setLead(res.data);
      setEditForm(res.data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  const handleStatusChange = async (status: LeadStatus) => {
    try {
      await api.put(`/crm/leads/${id}`, { status });
      toast.success(`Status updated to ${status.replace("_", " ")}`);
      fetchLead();
    } catch {
      // handled
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/crm/leads/${id}`, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        city: editForm.city,
        state: editForm.state,
        address: editForm.address,
        estimated_value: editForm.estimated_value,
        notes: editForm.notes,
        lost_reason: editForm.lost_reason,
      });
      toast.success("Lead updated");
      setEditing(false);
      fetchLead();
    } catch {
      // handled
    }
  };

  const handleConvert = async (createProject: boolean, projectName: string) => {
    try {
      await api.post(`/crm/leads/${id}/convert`, {
        create_project: createProject,
        project_name: projectName || null,
      });
      toast.success("Lead converted to client!");
      setShowConvert(false);
      fetchLead();
    } catch {
      // handled
    }
  };

  const handleScanMeasurements = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningMeasurement(true);
    const toastId = toast.loading("Reading measurement sheet...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/crm/leads/${id}/measurements/scan`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const rooms = res.data as { room: string }[];
      toast.success(`Scanned ${rooms.length} room${rooms.length !== 1 ? "s" : ""} — review below`, { id: toastId });
      fetchLead();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Couldn't read the measurement sheet";
      toast.error(msg, { id: toastId });
    } finally {
      setScanningMeasurement(false);
      if (measurementScanRef.current) measurementScanRef.current.value = "";
    }
  };

  const handleAddMeasurement = async () => {
    if (!measurementForm.room.trim()) { toast.error("Enter a room name"); return; }
    try {
      await api.post(`/crm/leads/${id}/measurements`, {
        room: measurementForm.room,
        length_mm: measurementForm.length_mm ? parseFloat(measurementForm.length_mm) : null,
        width_mm: measurementForm.width_mm ? parseFloat(measurementForm.width_mm) : null,
        height_mm: measurementForm.height_mm ? parseFloat(measurementForm.height_mm) : null,
        notes: measurementForm.notes || null,
      });
      toast.success("Measurement added");
      setMeasurementForm({ room: "", length_mm: "", width_mm: "", height_mm: "", notes: "" });
      setShowAddMeasurement(false);
      fetchLead();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to add measurement";
      toast.error(msg);
    }
  };

  const handleDeleteMeasurement = async (measurementId: number) => {
    try {
      await api.delete(`/crm/leads/${id}/measurements/${measurementId}`);
      fetchLead();
    } catch {
      // handled
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!lead) return <div className="p-8 text-center text-gray-500">Lead not found</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.lead_number}
        subtitle={lead.name}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/crm/leads")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {lead.status !== "WON" && lead.status !== "LOST" && (
              <Button onClick={() => setShowConvert(true)} className="bg-green-600 hover:bg-green-700">
                <UserCheck className="mr-2 h-4 w-4" />
                Convert to Client
              </Button>
            )}
          </div>
        }
      />

      {/* Status Pipeline Bar */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-2 overflow-x-auto">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              lead.status === s
                ? "bg-indigo-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Lead Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Lead Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </Button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <Input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Name"
                />
                <Input
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Phone"
                />
                <Input
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="Email"
                />
                <Input
                  value={editForm.city || ""}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="City"
                />
                <Input
                  type="number"
                  value={editForm.estimated_value || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, estimated_value: Number(e.target.value) || null })
                  }
                  placeholder="Estimated Value"
                />
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Notes"
                />
                {lead.status === "LOST" && (
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                    value={editForm.lost_reason || ""}
                    onChange={(e) => setEditForm({ ...editForm, lost_reason: e.target.value })}
                    placeholder="Lost reason"
                  />
                )}
                <Button onClick={handleSave} className="w-full">Save</Button>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{lead.phone || "No phone"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{lead.email || "No email"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{[lead.city, lead.state].filter(Boolean).join(", ") || "No location"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTime(lead.created_at)}</span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <Badge variant="secondary">{lead.source.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">Status</span>
                    <LeadStatusBadge status={lead.status} />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">Assigned</span>
                    <span className="text-gray-900">{lead.assignee_name || "Unassigned"}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">Value</span>
                    <span className="font-medium text-gray-900">
                      {lead.estimated_value ? formatINR(lead.estimated_value) : "—"}
                    </span>
                  </div>
                </div>

                {lead.notes && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-gray-700">{lead.notes}</p>
                  </div>
                )}

                {lead.client_id && (
                  <div className="border-t pt-3 mt-3">
                    <Link
                      to={`/clients/${lead.client_id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      View Client Profile →
                    </Link>
                  </div>
                )}

                {lead.project_id && (
                  <div className="mt-1">
                    <Link
                      to={`/projects/${lead.project_id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      View Project →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowInteraction(true)}>
              <PhoneCall className="mr-2 h-4 w-4" />
              Log Interaction
            </Button>
            <Button variant="outline" onClick={() => setShowFollowup(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Follow-up
            </Button>
          </div>

          {/* Site Measurements */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <input ref={measurementScanRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={handleScanMeasurements} />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-gray-400" /> Site Measurements
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={scanningMeasurement}
                  onClick={() => measurementScanRef.current?.click()}>
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  {scanningMeasurement ? "Scanning..." : "Scan Sheet (AI)"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddMeasurement(!showAddMeasurement)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Room
                </Button>
              </div>
            </div>

            {showAddMeasurement && (
              <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-md bg-gray-50 p-3">
                <Input placeholder="Room" value={measurementForm.room}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, room: e.target.value })} />
                <Input type="number" placeholder="Length (mm)" value={measurementForm.length_mm}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, length_mm: e.target.value })} />
                <Input type="number" placeholder="Width (mm)" value={measurementForm.width_mm}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, width_mm: e.target.value })} />
                <Input type="number" placeholder="Height (mm)" value={measurementForm.height_mm}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, height_mm: e.target.value })} />
                <Input placeholder="Notes" value={measurementForm.notes}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, notes: e.target.value })} />
                <Button size="sm" className="col-span-2 sm:col-span-1" onClick={handleAddMeasurement}>Save</Button>
              </div>
            )}

            {lead.measurements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No measurements yet. Scan a photo of the site sheet, or add a room manually.
              </p>
            ) : (
              <div className="space-y-2">
                {lead.measurements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{m.room}</span>
                      <span className="text-gray-500 ml-2">
                        {[m.length_mm, m.width_mm, m.height_mm].filter((v) => v != null).map((v) => `${v}mm`).join(" × ") || "no dimensions"}
                      </span>
                      {m.source === "AI_SCAN" && (
                        <Badge variant="secondary" className="ml-2 text-[10px]"><Sparkles className="h-2.5 w-2.5 mr-0.5 inline" />AI</Badge>
                      )}
                      {m.notes && <p className="text-xs text-gray-400 mt-0.5">{m.notes}</p>}
                    </div>
                    <button onClick={() => handleDeleteMeasurement(m.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups */}
          {lead.followups.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Follow-ups</h3>
              <div className="space-y-2">
                {lead.followups.map((f) => {
                  const isOverdue =
                    f.status === "PENDING" && new Date(f.scheduled_at) < new Date();
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                        f.status === "COMPLETED"
                          ? "border-green-200 bg-green-50"
                          : isOverdue
                          ? "border-red-200 bg-red-50"
                          : "border-gray-100"
                      }`}
                    >
                      <div>
                        <p className="text-sm text-gray-900">{f.notes || "Follow-up scheduled"}</p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(f.scheduled_at)} — {f.assignee_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            f.status === "COMPLETED"
                              ? "default"
                              : isOverdue
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {f.status}
                        </Badge>
                        {f.status === "PENDING" && (
                          <button
                            onClick={async () => {
                              await api.put(`/crm/followups/${f.id}`, { status: "COMPLETED" });
                              toast.success("Follow-up completed");
                              fetchLead();
                            }}
                            className="text-green-600 hover:text-green-700"
                            title="Mark completed"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interaction Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Interaction Timeline</h3>
            {lead.interactions.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No interactions yet</p>
            ) : (
              <div className="space-y-3">
                {lead.interactions.map((i) => (
                  <div key={i.id} className="flex gap-3 border-l-2 border-indigo-200 pl-4 pb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {i.interaction_type.replace("_", " ")}
                        </Badge>
                        {i.call_source === "ANDROID_APP" && (
                          <Badge variant="secondary" className="text-[10px]">AUTO</Badge>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatRelative(i.created_at)}
                        </span>
                      </div>
                      {i.summary && (
                        <p className="mt-1 text-sm text-gray-700">{i.summary}</p>
                      )}
                      {i.ai_summary && (
                        <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-2">
                          <p className="flex items-center gap-1 text-[11px] font-medium text-indigo-700">
                            <Sparkles className="h-3 w-3" /> AI triage
                          </p>
                          <p className="mt-1 text-xs text-gray-700">{i.ai_summary}</p>
                          {i.ai_suggested_reply && (
                            <div className="mt-1.5 flex items-start gap-1.5">
                              <p className="flex-1 text-xs italic text-gray-600">"{i.ai_suggested_reply}"</p>
                              <button
                                title="Copy suggested reply"
                                onClick={() => {
                                  navigator.clipboard.writeText(i.ai_suggested_reply || "");
                                  toast.success("Reply copied");
                                }}
                                className="flex-shrink-0 rounded p-1 text-indigo-500 hover:bg-indigo-100"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {i.phone_number && `${i.phone_number} · `}
                        {i.duration_seconds && `${Math.floor(i.duration_seconds / 60)}m ${i.duration_seconds % 60}s · `}
                        by {i.logger_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Interaction Dialog */}
      <LogInteractionDialog
        open={showInteraction}
        onClose={() => setShowInteraction(false)}
        leadId={lead.id}
        onCreated={fetchLead}
      />

      {/* Schedule Followup Dialog */}
      <ScheduleFollowupDialog
        open={showFollowup}
        onClose={() => setShowFollowup(false)}
        leadId={lead.id}
        onCreated={fetchLead}
      />

      {/* Convert Dialog */}
      <ConvertLeadDialog
        open={showConvert}
        onClose={() => setShowConvert(false)}
        leadName={lead.name}
        onConvert={handleConvert}
      />
    </div>
  );
}

function LogInteractionDialog({
  open,
  onClose,
  leadId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadId: number;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    interaction_type: "INCOMING_CALL" as InteractionType,
    phone_number: "",
    duration_seconds: "",
    summary: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post("/crm/interactions", {
        lead_id: leadId,
        interaction_type: form.interaction_type,
        phone_number: form.phone_number || null,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        summary: form.summary || null,
      });
      toast.success("Interaction logged");
      onClose();
      onCreated();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Type</label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Duration (seconds)</label>
              <Input
                type="number"
                value={form.duration_seconds}
                onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Summary</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="What was discussed..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Log Interaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleFollowupDialog({
  open,
  onClose,
  leadId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadId: number;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    scheduled_at: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.scheduled_at) {
      toast.error("Please select a date and time");
      return;
    }
    setSaving(true);
    try {
      await api.post("/crm/followups", {
        lead_id: leadId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        notes: form.notes || null,
      });
      toast.success("Follow-up scheduled");
      onClose();
      onCreated();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Date & Time</label>
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What to follow up about..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertLeadDialog({
  open,
  onClose,
  leadName,
  onConvert,
}: {
  open: boolean;
  onClose: () => void;
  leadName: string;
  onConvert: (createProject: boolean, projectName: string) => void;
}) {
  const [createProject, setCreateProject] = useState(true);
  const [projectName, setProjectName] = useState(`${leadName} - Project`);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Lead to Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            This will create a new Client from <strong>{leadName}</strong>'s details and
            transfer all interactions.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createProject"
              checked={createProject}
              onChange={(e) => setCreateProject(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="createProject" className="text-sm text-gray-700">
              Also create a Project
            </label>
          </div>
          {createProject && (
            <div>
              <label className="text-sm font-medium text-gray-700">Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onConvert(createProject, projectName)}
            className="bg-green-600 hover:bg-green-700"
          >
            Convert to Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
