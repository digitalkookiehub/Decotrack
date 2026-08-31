import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";

interface Material { id: number; name: string; sku: string; unit: string; }
interface BOMLine { raw_material_id: number; material_name: string; material_sku: string; material_unit: string; quantity_per_unit: string; notes: string; }

export function BOMEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [productName, setProductName] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [lines, setLines] = useState<BOMLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/finished-products/${id}`),
      api.get(`/finished-products/${id}/bom`),
      api.get("/raw-materials?per_page=100"),
    ]).then(([prodRes, bomRes, matRes]) => {
      setProductName(prodRes.data.name);
      setMaterials(matRes.data.items || []);
      setLines(
        (bomRes.data as Array<Record<string, unknown>>).map((b) => ({
          raw_material_id: b.raw_material_id as number,
          material_name: (b.material_name as string) || "",
          material_sku: (b.material_sku as string) || "",
          material_unit: (b.material_unit as string) || "",
          quantity_per_unit: String(b.quantity_per_unit),
          notes: (b.notes as string) || "",
        }))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const addLine = () => {
    setLines([...lines, { raw_material_id: 0, material_name: "", material_sku: "", material_unit: "", quantity_per_unit: "", notes: "" }]);
  };

  const updateMaterial = (idx: number, materialId: number) => {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], raw_material_id: materialId, material_name: mat.name, material_sku: mat.sku, material_unit: mat.unit };
    setLines(newLines);
  };

  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const validLines = lines.filter((l) => l.raw_material_id > 0 && parseFloat(l.quantity_per_unit) > 0);
    if (validLines.length === 0) { toast.error("Add at least one material"); return; }

    setSaving(true);
    try {
      await api.put(`/finished-products/${id}/bom`, {
        items: validLines.map((l) => ({
          raw_material_id: l.raw_material_id,
          quantity_per_unit: parseFloat(l.quantity_per_unit),
          notes: l.notes || null,
        })),
      });
      toast.success("BOM saved successfully");
      navigate(`/products/${id}`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save BOM");
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title={`BOM Editor — ${productName}`} subtitle="Define raw materials needed per unit"
        action={<Button variant="outline" onClick={() => navigate(`/products/${id}`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to Product</Button>} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Bill of Materials ({lines.length} items)</CardTitle>
          <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add Material</Button>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No materials in BOM. Click "Add Material" to define what's needed to make one unit of this product.</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Material {idx + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-gray-500">Raw Material *</Label>
                      <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                        value={line.raw_material_id || ""} onChange={(e) => { if (e.target.value) updateMaterial(idx, parseInt(e.target.value)); }}>
                        <option value="">-- Select material --</option>
                        {materials.map((m) => (
                          <option key={m.id} value={String(m.id)}>{m.name} ({m.sku}) — {m.unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Qty per Unit *</Label>
                      <Input className="mt-1" type="number" step="0.01" placeholder="e.g., 2"
                        value={line.quantity_per_unit}
                        onChange={(e) => { const n = [...lines]; n[idx] = { ...n[idx], quantity_per_unit: e.target.value }; setLines(n); }} />
                      {line.material_unit && <p className="text-[10px] text-gray-400 mt-0.5">{line.material_unit} per unit</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Notes</Label>
                      <Input className="mt-1" placeholder="Optional" value={line.notes}
                        onChange={(e) => { const n = [...lines]; n[idx] = { ...n[idx], notes: e.target.value }; setLines(n); }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => navigate(`/products/${id}`)}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save BOM"}</Button>
      </div>
    </div>
  );
}
