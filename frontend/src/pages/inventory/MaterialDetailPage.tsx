import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, PlusCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../../components/ui/dialog";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR, formatNumber } from "../../lib/currency";
import { formatDate, formatDateTime } from "../../lib/date";
import api from "../../services/api";

interface Category {
  id: number;
  name: string;
}

interface Material {
  id: number;
  category_id: number | null;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  current_stock: number;
  reorder_level: number;
  last_purchase_rate: number;
  hsn_code: string | null;
  gst_rate: number;
  is_active: boolean;
  created_at: string;
}

interface Batch {
  id: number;
  batch_number: string;
  received_date: string;
  quantity_received: number;
  quantity_remaining: number;
  purchase_rate: number;
}

interface Movement {
  id: number;
  movement_type: string;
  quantity: number;
  qty_before: number;
  qty_after: number;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string;
}

export function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [material, setMaterial] = useState<Material | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Material>>({});
  const [saving, setSaving] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantity: "", reason: "" });
  const [adjusting, setAdjusting] = useState(false);

  const fetchAll = () => {
    Promise.all([
      api.get(`/raw-materials/${id}`),
      api.get("/categories/"),
      api.get(`/raw-materials/${id}/stock`),
      api.get(`/raw-materials/${id}/movements?per_page=20`),
    ]).then(([mRes, catRes, stockRes, movRes]) => {
      setMaterial(mRes.data);
      setForm(mRes.data);
      setCategories(catRes.data);
      setBatches(stockRes.data.batches || []);
      setMovements(movRes.data.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/raw-materials/${id}`, {
        category_id: form.category_id ?? null,
        name: form.name,
        description: form.description,
        reorder_level: form.reorder_level,
        hsn_code: form.hsn_code,
        gst_rate: form.gst_rate,
        is_active: form.is_active,
      });
      setMaterial(res.data);
      setEditing(false);
      toast.success("Material updated");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to update");
    } finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    const qty = parseFloat(adjustForm.quantity);
    if (!qty) { toast.error("Enter a non-zero quantity"); return; }
    if (!adjustForm.reason.trim()) { toast.error("Reason is required"); return; }
    setAdjusting(true);
    try {
      await api.post(`/raw-materials/${id}/adjust`, { quantity: qty, reason: adjustForm.reason });
      toast.success("Stock adjusted");
      setShowAdjust(false);
      setAdjustForm({ quantity: "", reason: "" });
      fetchAll();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to adjust stock");
    } finally { setAdjusting(false); }
  };

  if (loading || !material) return <LoadingSpinner />;

  const belowReorder = material.current_stock <= material.reorder_level;
  const categoryName = categories.find((c) => c.id === material.category_id)?.name;

  return (
    <div>
      <PageHeader title={material.name} subtitle={`SKU: ${material.sku}`}
        action={
          <div className="flex gap-2">
            {!editing && <Button variant="outline" onClick={() => setEditing(true)}><Edit2 className="h-4 w-4 mr-2" />Edit</Button>}
            <Button variant="outline" onClick={() => setShowAdjust(true)}><PlusCircle className="h-4 w-4 mr-2" />Adjust Stock</Button>
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Material Information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Name</Label><Input className="mt-1" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div>
                    <Label>Category</Label>
                    <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                      value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value ? parseInt(e.target.value) : null })}>
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><Label>Reorder Level</Label><Input className="mt-1" type="number" step="0.01" value={form.reorder_level ?? ""} onChange={(e) => setForm({ ...form, reorder_level: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>GST Rate (%)</Label><Input className="mt-1" type="number" step="0.01" value={form.gst_rate ?? ""} onChange={(e) => setForm({ ...form, gst_rate: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>HSN Code</Label><Input className="mt-1" value={form.hsn_code || ""} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} /></div>
                  <div className="flex items-center gap-2 pt-6">
                    <input type="checkbox" className="rounded border-gray-300" checked={form.is_active ?? true}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    <Label>Active</Label>
                  </div>
                  <div className="sm:col-span-2"><Label>Description</Label><Textarea className="mt-1" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                    <Button variant="outline" onClick={() => { setEditing(false); setForm(material); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {categoryName && <div><span className="text-gray-500">Category: </span><span className="font-medium">{categoryName}</span></div>}
                  <div><span className="text-gray-500">Unit: </span><span className="font-medium">{material.unit}</span></div>
                  {material.hsn_code && <div><span className="text-gray-500">HSN Code: </span>{material.hsn_code}</div>}
                  <div><span className="text-gray-500">GST Rate: </span>{material.gst_rate}%</div>
                  <div><span className="text-gray-500">Status: </span>
                    {material.is_active ? <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge> : <Badge className="bg-red-100 text-red-700 text-[10px]">Inactive</Badge>}
                  </div>
                  {material.description && <div className="text-gray-600 pt-2 border-t">{material.description}</div>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batches (FIFO) */}
          <Card>
            <CardHeader><CardTitle className="text-base">Stock Batches ({batches.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {batches.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No stock batches yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Batch #</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Received</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Qty Received</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Remaining</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2 font-mono text-xs">{b.batch_number}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{formatDate(b.received_date)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(b.quantity_received)} {material.unit}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNumber(b.quantity_remaining)} {material.unit}</td>
                        <td className="px-4 py-2 text-right">{formatINR(b.purchase_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Movement History */}
          <Card>
            <CardHeader><CardTitle className="text-base">Movement History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {movements.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No movements recorded yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Before → After</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Notes</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2"><Badge variant="secondary" className="text-[10px]">{m.movement_type}</Badge></td>
                        <td className={`px-4 py-2 text-right font-medium ${m.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                          {m.quantity > 0 ? "+" : ""}{formatNumber(m.quantity)}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-gray-500">{formatNumber(m.qty_before)} → {formatNumber(m.qty_after)}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{m.notes || "—"}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{formatDateTime(m.created_at)}</td>
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
            <CardHeader><CardTitle className="text-base">Stock Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Current Stock</span>
                <span className={`font-semibold ${belowReorder ? "text-red-600" : "text-gray-900"}`}>{formatNumber(material.current_stock)} {material.unit}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Reorder Level</span><span>{formatNumber(material.reorder_level)} {material.unit}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Last Purchase Rate</span><span>{formatINR(material.last_purchase_rate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Stock Value</span><span className="font-medium text-indigo-600">{formatINR(material.current_stock * material.last_purchase_rate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{formatDate(material.created_at)}</span></div>
              {belowReorder && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                  Stock is at or below reorder level
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {material.name}</DialogTitle>
            <DialogDescription>Use a positive quantity to add stock, negative to remove. This creates an audit-logged movement.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Quantity ({material.unit}) *</Label>
              <Input className="mt-1" type="number" step="0.01" placeholder="e.g. 10 or -5"
                value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea className="mt-1" placeholder="e.g. Physical stock count correction"
                value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjusting}>{adjusting ? "Adjusting..." : "Adjust Stock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
