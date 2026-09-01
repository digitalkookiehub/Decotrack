import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, FileText, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface Vendor {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  supply_categories: string[] | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface PO {
  id: number;
  po_number: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pos, setPOs] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/vendors/${id}`),
      api.get(`/purchase-orders/?per_page=50&vendor_id=${id}`),
    ]).then(([vRes, poRes]) => {
      setVendor(vRes.data);
      setForm(vRes.data);
      setPOs(poRes.data.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/vendors/${id}`, {
        name: form.name, contact_person: form.contact_person, phone: form.phone,
        email: form.email, address: form.address, city: form.city, state: form.state,
        gstin: form.gstin, payment_terms: form.payment_terms, notes: form.notes,
      });
      setVendor(res.data);
      setEditing(false);
      toast.success("Vendor updated");
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  if (loading || !vendor) return <LoadingSpinner />;

  const totalSpend = pos.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div>
      <PageHeader title={vendor.name} subtitle={vendor.city ? `${vendor.city}${vendor.state ? `, ${vendor.state}` : ""}` : "Vendor"}
        action={
          <div className="flex gap-2">
            {!editing && <Button variant="outline" onClick={() => setEditing(true)}><Edit2 className="h-4 w-4 mr-2" />Edit</Button>}
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Vendor Information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Name *</Label><Input className="mt-1" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Contact Person</Label><Input className="mt-1" value={form.contact_person || ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input className="mt-1" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input className="mt-1" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>City</Label><Input className="mt-1" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div><Label>State</Label><Input className="mt-1" value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                  <div><Label>GSTIN</Label><Input className="mt-1" value={form.gstin || ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
                  <div><Label>Payment Terms</Label>
                    <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                      value={form.payment_terms || ""} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
                      <option value="">Select payment terms</option>
                      <option value="Cash on Delivery">Cash on Delivery</option>
                      <option value="Immediate">Immediate</option>
                      <option value="Net 7">Net 7 (7 days)</option>
                      <option value="Net 15">Net 15 (15 days)</option>
                      <option value="Net 30">Net 30 (30 days)</option>
                      <option value="Net 45">Net 45 (45 days)</option>
                      <option value="Net 60">Net 60 (60 days)</option>
                      <option value="50% Advance">50% Advance, rest on delivery</option>
                      <option value="100% Advance">100% Advance</option>
                      <option value="Credit 30 days">Credit 30 days</option>
                      <option value="Credit 45 days">Credit 45 days</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2"><Label>Address</Label><Input className="mt-1" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Notes</Label><Input className="mt-1" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                    <Button variant="outline" onClick={() => { setEditing(false); setForm(vendor); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendor.contact_person && <div className="text-sm"><span className="text-gray-500">Contact: </span><span className="font-medium">{vendor.contact_person}</span></div>}
                  {vendor.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-gray-400" />{vendor.phone}</div>}
                  {vendor.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-gray-400" />{vendor.email}</div>}
                  {vendor.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-gray-400" />{vendor.address}{vendor.city ? `, ${vendor.city}` : ""}{vendor.state ? `, ${vendor.state}` : ""}</div>}
                  {vendor.gstin && <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-gray-400" />GSTIN: {vendor.gstin}</div>}
                  {vendor.payment_terms && <div className="text-sm"><span className="text-gray-500">Payment: </span>{vendor.payment_terms}</div>}
                  {vendor.supply_categories && vendor.supply_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">{vendor.supply_categories.map((c) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}</div>
                  )}
                  {vendor.notes && <div className="text-sm text-gray-600 pt-2 border-t">{vendor.notes}</div>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase History */}
          <Card>
            <CardHeader><CardTitle className="text-base">Purchase History ({pos.length} POs)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {pos.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No purchase orders with this vendor</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">PO #</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pos.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                        <td className="px-4 py-2 font-medium text-indigo-600">{po.po_number}</td>
                        <td className="px-4 py-2 text-center"><StatusBadge status={po.status} /></td>
                        <td className="px-4 py-2 text-right font-medium">{formatINR(po.total_amount)}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{formatDate(po.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total POs</span><span className="font-medium">{pos.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Spend</span><span className="font-medium text-indigo-600">{formatINR(totalSpend)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{formatDate(vendor.created_at)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
