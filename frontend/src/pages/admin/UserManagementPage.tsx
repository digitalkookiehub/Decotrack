import { useEffect, useState } from "react";
import { Plus, UserCog } from "lucide-react";
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
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", role: "EMPLOYEE" });
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", role: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    api.get("/admin/users?per_page=50")
      .then((res) => setUsers(res.data.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) { toast.error("Fill all required fields"); return; }
    if (form.password.length < 8) { toast.error("Password min 8 characters"); return; }
    setSaving(true);
    try {
      await api.post("/admin/users", form);
      toast.success("User created");
      setShowAdd(false);
      setForm({ email: "", password: "", full_name: "", phone: "", role: "EMPLOYEE" });
      fetchUsers();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${editUser.id}`, editForm);
      toast.success("User updated");
      setShowEdit(false);
      fetchUsers();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ full_name: user.full_name, phone: user.phone || "", role: user.role, is_active: user.is_active });
    setShowEdit(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users`}
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add User</Button>} />

      {users.length === 0 ? (
        <EmptyState icon={UserCog} title="No users" description="Add your first user" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.is_active ? (
                      <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 text-[10px]">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle><DialogDescription>Create a new employee or admin account</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Full Name *</Label><Input className="mt-1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password * (min 8 chars)</Label><Input className="mt-1" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label>Role *</Label>
              <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User — {editUser?.full_name}</DialogTitle><DialogDescription>{editUser?.email}</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Full Name</Label><Input className="mt-1" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300" checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
