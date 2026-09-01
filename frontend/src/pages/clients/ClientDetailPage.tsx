import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, FileText, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  notes: string | null;
  created_at: string;
}

interface Project {
  id: number;
  client_id: number;
  project_number: string;
  name: string;
  status: string;
  estimated_cost: number;
  items_count: number;
  created_at: string;
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/clients/${id}`),
      api.get(`/projects/?per_page=50`),
    ]).then(([clientRes, projectsRes]) => {
      setClient(clientRes.data);
      setForm(clientRes.data);
      // Filter projects for this client
      const clientProjects = (projectsRes.data.items as Project[]).filter(
        (p) => p.client_id === parseInt(id || "0")
      );
      setProjects(clientProjects);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/clients/${id}`, {
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        gstin: form.gstin,
        notes: form.notes,
      });
      setClient(res.data);
      setEditing(false);
      toast.success("Client updated");
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  if (loading || !client) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title={client.name} subtitle={client.city ? `${client.city}${client.state ? `, ${client.state}` : ""}` : "Client"}
        action={
          <div className="flex gap-2">
            {!editing && <Button variant="outline" onClick={() => setEditing(true)}><Edit2 className="h-4 w-4 mr-2" />Edit</Button>}
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Name *</Label><Input className="mt-1" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input className="mt-1" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input className="mt-1" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>City</Label><Input className="mt-1" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div><Label>State</Label><Input className="mt-1" value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                  <div><Label>GSTIN</Label><Input className="mt-1" value={form.gstin || ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Address</Label><Input className="mt-1" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Notes</Label><Input className="mt-1" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                    <Button variant="outline" onClick={() => { setEditing(false); setForm(client); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-gray-400" /><span>{client.phone}</span></div>}
                  {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-gray-400" /><span>{client.email}</span></div>}
                  {client.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-gray-400" /><span>{client.address}{client.city ? `, ${client.city}` : ""}{client.state ? `, ${client.state}` : ""}</span></div>}
                  {client.gstin && <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-gray-400" /><span>GSTIN: {client.gstin}</span></div>}
                  {client.notes && <div className="text-sm text-gray-600 mt-2 pt-2 border-t">{client.notes}</div>}
                  {!client.phone && !client.email && !client.address && <p className="text-sm text-gray-400">No contact details added</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Projects ({projects.length})</CardTitle>
              <Link to="/projects/new"><Button size="sm" variant="outline">New Project</Button></Link>
            </CardHeader>
            <CardContent className="p-0">
              {projects.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No projects for this client yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {projects.map((p) => (
                    <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-indigo-600">{p.project_number}</p>
                        <p className="text-sm text-gray-900">{p.name}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={p.status} />
                        <p className="text-xs text-gray-500 mt-1">{formatINR(p.estimated_cost)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Projects</span><span className="font-medium">{projects.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Estimated</span><span className="font-medium">{formatINR(projects.reduce((s, p) => s + p.estimated_cost, 0))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{formatDate(client.created_at)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
