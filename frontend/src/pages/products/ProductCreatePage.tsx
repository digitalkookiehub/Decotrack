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

interface Category { id: number; name: string; }

export function ProductCreatePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", category_id: "", description: "", unit: "PCS" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/product-categories").then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!form.sku.trim()) { toast.error("SKU is required"); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        description: form.description || null,
        unit: form.unit,
      };
      const res = await api.post("/finished-products", payload);
      toast.success("Product created");
      navigate(`/products/${res.data.id}`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="New Product"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <Card>
        <CardHeader><CardTitle className="text-base">Product Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label>Product Name *</Label><Input className="mt-1" placeholder="e.g., Kitchen Base Unit 600mm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>SKU *</Label><Input className="mt-1" placeholder="e.g., KBU-600" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} /></div>
          <div>
            <Label>Category</Label>
            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Unit *</Label>
            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="PCS">PCS (Pieces)</option>
              <option value="SQM">SQM (Square Meter)</option>
              <option value="SET">SET</option>
            </select>
          </div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea className="mt-1" placeholder="Optional description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create Product"}</Button>
      </div>
    </div>
  );
}
