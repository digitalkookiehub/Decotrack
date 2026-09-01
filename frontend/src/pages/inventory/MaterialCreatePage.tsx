import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import api from "../../services/api";

interface Category {
  id: number;
  name: string;
}

const UNITS = ["PCS", "SQM", "M", "KG", "PAIR", "LITRE", "SET"];

export function MaterialCreatePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "", sku: "", category_id: "", description: "",
    unit: "PCS", reorder_level: "0", hsn_code: "", gst_rate: "18",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/categories/").then((res) => setCategories(res.data));
  }, []);

  const set = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Material name is required"); return; }
    if (!form.sku.trim()) { toast.error("SKU is required"); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        description: form.description || null,
        unit: form.unit,
        reorder_level: parseFloat(form.reorder_level) || 0,
        hsn_code: form.hsn_code || null,
        gst_rate: parseFloat(form.gst_rate) || 0,
      };
      const res = await api.post("/raw-materials", payload);
      toast.success("Material created");
      navigate(`/inventory/materials/${res.data.id}`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create material");
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="Add Material"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <Card>
        <CardHeader><CardTitle className="text-base">Material Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label>Name *</Label><Input className="mt-1" placeholder="Plywood 18mm" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>SKU *</Label><Input className="mt-1" placeholder="PLY-18MM-001" value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Unit *</Label>
            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={form.unit} onChange={(e) => set("unit", e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div><Label>Reorder Level</Label><Input className="mt-1" type="number" step="0.01" placeholder="0" value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} /></div>
          <div><Label>GST Rate (%)</Label><Input className="mt-1" type="number" step="0.01" placeholder="18" value={form.gst_rate} onChange={(e) => set("gst_rate", e.target.value)} /></div>
          <div><Label>HSN Code</Label><Input className="mt-1" placeholder="4412" value={form.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea className="mt-1" placeholder="Optional notes about this material..." value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create Material"}</Button>
      </div>
    </div>
  );
}
