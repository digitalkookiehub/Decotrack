import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import api from "../../services/api";

interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
}

export function ClientListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", address: "" });
  const [saving, setSaving] = useState(false);

  const search = searchParams.get("search") || "";

  const fetchClients = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("per_page", "50");
    if (search) params.set("search", search);
    api.get(`/clients/?${params}`)
      .then((res) => { setClients(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchClients(); }, [search]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await api.post("/clients/", form);
      toast.success("Client created");
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", city: "", address: "" });
      fetchClients();
    } catch { toast.error("Failed to create client"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${total} clients`}
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add Client</Button>} />

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search clients..." className="pl-9" defaultValue={search}
          onChange={(e) => { const p = new URLSearchParams(searchParams); if (e.target.value) p.set("search", e.target.value); else p.delete("search"); setSearchParams(p); }} />
      </div>

      {loading ? <LoadingSpinner /> : clients.length === 0 ? (
        <EmptyState icon={Users} title="No clients" description="Add your first client"
          action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add Client</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/clients/${c.id}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.city ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>City</Label><Input className="mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Address</Label><Input className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
