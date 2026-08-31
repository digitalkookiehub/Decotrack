import { useEffect, useState } from "react";
import { Plus, Truck, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../../components/ui/dialog";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import api from "../../services/api";

interface Driver {
  id: number;
  name: string;
  phone: string;
  license_number: string | null;
  vehicle_number: string | null;
  is_active: boolean;
}

export function DriverListPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", license_number: "", vehicle_number: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", license_number: "", vehicle_number: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchDrivers = () => {
    setLoading(true);
    api.get("/drivers/?per_page=50&active_only=false")
      .then((res) => setDrivers(res.data.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDrivers(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.phone) { toast.error("Name and phone required"); return; }
    setSaving(true);
    try {
      await api.post("/drivers/", form);
      toast.success("Driver added");
      setShowAdd(false);
      setForm({ name: "", phone: "", license_number: "", vehicle_number: "" });
      fetchDrivers();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editDriver) return;
    setSaving(true);
    try {
      await api.put(`/drivers/${editDriver.id}`, editForm);
      toast.success("Driver updated");
      setShowEdit(false);
      fetchDrivers();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  const openEdit = (d: Driver) => {
    setEditDriver(d);
    setEditForm({ name: d.name, phone: d.phone, license_number: d.license_number || "", vehicle_number: d.vehicle_number || "", is_active: d.is_active });
    setShowEdit(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Drivers" subtitle={`${drivers.length} drivers`}
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add Driver</Button>} />

      {drivers.length === 0 ? (
        <EmptyState icon={Truck} title="No drivers" description="Add your first driver"
          action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add Driver</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">License</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vehicle</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.phone}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.license_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{d.vehicle_number || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {d.is_active
                      ? <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
                      : <Badge className="bg-red-100 text-red-700 text-[10px]">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => openEdit(d)}><Edit2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Driver</DialogTitle><DialogDescription>Add a new driver for dispatches</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input className="mt-1" placeholder="Driver name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone *</Label><Input className="mt-1" placeholder="9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>License Number</Label><Input className="mt-1" placeholder="TN-DL-1234567890" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
            <div><Label>Default Vehicle</Label><Input className="mt-1" placeholder="TN 01 AB 1234" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Adding..." : "Add Driver"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Driver — {editDriver?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input className="mt-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label>Phone *</Label><Input className="mt-1" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><Label>License Number</Label><Input className="mt-1" value={editForm.license_number} onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })} /></div>
            <div><Label>Default Vehicle</Label><Input className="mt-1" value={editForm.vehicle_number} onChange={(e) => setEditForm({ ...editForm, vehicle_number: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300" checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
