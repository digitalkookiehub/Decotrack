import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { formatINR } from "../../lib/currency";
import api from "../../services/api";

interface Project {
  id: number;
  project_number: string;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  category_name: string | null;
  unit: string;
}

interface WOLine {
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: string;
}

interface MaterialCheck {
  material_name: string;
  material_sku: string;
  unit: string;
  required: number;
  available: number;
  sufficient: boolean;
  deficit: number;
  product_name?: string;
}

export function WOCreatePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<WOLine[]>([]);
  const [materialCheck, setMaterialCheck] = useState<MaterialCheck[] | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/projects/?per_page=100").then((res) => setProjects(res.data.items || [])).catch(() => {});
    api.get("/finished-products?per_page=100").then((res) => setProducts(res.data.items || [])).catch(() => {});
  }, []);

  const addItem = () => {
    setItems([...items, { product_id: 0, product_name: "", product_sku: "", quantity: "1" }]);
    setMaterialCheck(null);
  };

  const updateItem = (idx: number, productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], product_id: productId, product_name: product.name, product_sku: product.sku };
    setItems(newItems);
    setMaterialCheck(null);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    setMaterialCheck(null);
  };

  const checkMaterials = async () => {
    if (items.length === 0 || items.some((i) => !i.product_id)) {
      toast.error("Add products first");
      return;
    }
    setCheckLoading(true);
    try {
      const allChecks: MaterialCheck[] = [];
      for (const item of items) {
        const qty = parseInt(item.quantity) || 1;
        const res = await api.get(`/finished-products/${item.product_id}/material-check?qty=${qty}`);
        const checks = (res.data as MaterialCheck[]).map((c) => ({ ...c, product_name: item.product_name }));
        allChecks.push(...checks);
      }
      setMaterialCheck(allChecks);

      const insufficient = allChecks.filter((c) => !c.sufficient);
      if (insufficient.length === 0) {
        toast.success("All materials available!");
      } else {
        toast.error(`${insufficient.length} material(s) insufficient`);
      }
    } catch { toast.error("Failed to check materials"); }
    finally { setCheckLoading(false); }
  };

  const handleSubmit = async (submitForApproval: boolean) => {
    if (!projectId) { toast.error("Select a project"); return; }
    if (items.length === 0 || items.some((i) => !i.product_id)) { toast.error("Add at least one product"); return; }

    setSubmitting(true);
    try {
      const payload = {
        project_id: parseInt(projectId),
        notes: notes || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity) || 1,
        })),
      };

      const res = await api.post("/work-orders/", payload);
      const woId = res.data.id;

      if (submitForApproval) {
        await api.post(`/work-orders/${woId}/submit`);
        toast.success("Work order created and submitted for approval");
      } else {
        toast.success("Work order saved as draft");
      }

      navigate(`/work-orders/${woId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create work order";
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="New Work Order"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="grid gap-6">
        {/* Project & Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Work Order Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Project *</Label>
              <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Products to Manufacture</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={checkMaterials} disabled={checkLoading || items.length === 0}>
                {checkLoading ? "Checking..." : "Check Materials"}
              </Button>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />Add Product
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No products added. Click "Add Product" to start.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Product {idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs text-gray-500">Finished Product</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                          value={item.product_id || ""}
                          onChange={(e) => { const v = e.target.value; if (v) updateItem(idx, parseInt(v)); }}
                        >
                          <option value="">-- Select product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name} ({p.sku}) {p.category_name ? `— ${p.category_name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Quantity</Label>
                        <Input className="mt-1" type="number" min="1" value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], quantity: e.target.value };
                            setItems(newItems);
                            setMaterialCheck(null);
                          }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Material Availability Check */}
        {materialCheck && (
          <Card>
            <CardHeader><CardTitle className="text-base">Material Availability Check</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Material</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">For Product</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Required</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Available</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Deficit</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materialCheck.map((c, idx) => (
                    <tr key={idx} className={!c.sufficient ? "bg-red-50" : ""}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{c.material_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{c.material_sku}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{c.product_name}</td>
                      <td className="px-4 py-2 text-right">{c.required} {c.unit}</td>
                      <td className="px-4 py-2 text-right">{c.available} {c.unit}</td>
                      <td className="px-4 py-2 text-right">
                        {c.deficit > 0 ? (
                          <span className="text-red-600 font-semibold">{c.deficit} {c.unit}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {c.sufficient ? (
                          <CheckCircle className="h-5 w-5 text-green-500 inline" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {materialCheck.some((c) => !c.sufficient) && (
                <div className="p-3 bg-red-50 border-t border-red-200 text-sm text-red-700 font-medium">
                  Cannot submit — insufficient materials. Purchase the short materials first, then try again.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Cancel</Button>
          <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={submitting}>Save as Draft</Button>
          <Button onClick={() => handleSubmit(true)}
            disabled={submitting || (materialCheck !== null && materialCheck.some((c) => !c.sufficient))}>
            Save & Submit for Approval
          </Button>
        </div>
      </div>
    </div>
  );
}
