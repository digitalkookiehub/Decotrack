import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";
import toast from "react-hot-toast";

interface Material {
  id: number;
  name: string;
  sheet_width: number | null;
  sheet_height: number | null;
  price_per_sheet: number;
}

interface PartRow {
  label: string;
  length: string;
  width: string;
  quantity: string;
  grain_locked: boolean;
  edge_banding_l1: boolean;
  edge_banding_l2: boolean;
  edge_banding_w1: boolean;
  edge_banding_w2: boolean;
  rotation_locked: boolean;
}

const EMPTY_PART: PartRow = {
  label: "", length: "", width: "", quantity: "1",
  grain_locked: false, edge_banding_l1: false, edge_banding_l2: false,
  edge_banding_w1: false, edge_banding_w2: false, rotation_locked: false,
};

export function CutJobForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const csvRef = useRef<HTMLInputElement>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [sheetWidth, setSheetWidth] = useState("");
  const [sheetHeight, setSheetHeight] = useState("");
  const [bladeKerf, setBladeKerf] = useState("3");
  const [units, setUnits] = useState("MM");
  const [cutOrientation, setCutOrientation] = useState("LENGTH_FIRST");
  const [cuttingMethod, setCuttingMethod] = useState("GUILLOTINE");
  const [optimizationPriority, setOptimizationPriority] = useState("MINIMIZE_WASTE");
  const [parts, setParts] = useState<PartRow[]>([{ ...EMPTY_PART }, { ...EMPTY_PART }]);

  useEffect(() => {
    api.get("/cutlist/materials").then((r) => setMaterials(r.data)).catch(() => {});
    if (isEdit) {
      api.get(`/cutlist/jobs/${id}`).then((r) => {
        const j = r.data;
        setName(j.name);
        setMaterialId(j.material_id ? String(j.material_id) : "");
        setSheetWidth(String(j.sheet_width));
        setSheetHeight(String(j.sheet_height));
        setBladeKerf(String(j.blade_kerf));
        setUnits(j.units);
        setCutOrientation(j.cut_orientation);
        setCuttingMethod(j.cutting_method);
        setOptimizationPriority(j.optimization_priority);
        setParts(j.parts.map((p: PartRow & { length: number; width: number; quantity: number }) => ({
          ...p, length: String(p.length), width: String(p.width), quantity: String(p.quantity),
        })));
        setLoading(false);
      }).catch(() => { toast.error("Job not found"); navigate("/cutlist"); });
    }
  }, [id]);

  const handleMaterialChange = (mid: string) => {
    setMaterialId(mid);
    const mat = materials.find((m) => String(m.id) === mid);
    if (mat) {
      if (mat.sheet_width) setSheetWidth(String(mat.sheet_width));
      if (mat.sheet_height) setSheetHeight(String(mat.sheet_height));
    }
  };

  const addPart = () => setParts([...parts, { ...EMPTY_PART }]);
  const removePart = (i: number) => { if (parts.length > 1) setParts(parts.filter((_, idx) => idx !== i)); };
  const updatePart = (i: number, field: keyof PartRow, val: string | boolean) => {
    const updated = [...parts];
    updated[i] = { ...updated[i], [field]: val };
    setParts(updated);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const imported: PartRow[] = [];
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (i === 0 && cols[0].toLowerCase() === "label") continue; // skip header
        if (cols.length >= 4) {
          imported.push({
            ...EMPTY_PART,
            label: cols[0] || `Part ${i}`,
            length: cols[1] || "0",
            width: cols[2] || "0",
            quantity: cols[3] || "1",
          });
        }
      }
      if (imported.length > 0) {
        setParts(imported);
        toast.success(`Imported ${imported.length} parts from CSV`);
      }
    };
    reader.readAsText(file);
    if (csvRef.current) csvRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (name.trim().length < 3) { toast.error("Job name must be at least 3 characters"); return; }
    if (!sheetWidth || !sheetHeight) { toast.error("Sheet dimensions required"); return; }
    const validParts = parts.filter((p) => Number(p.length) > 0 && Number(p.width) > 0);
    if (validParts.length === 0) { toast.error("Add at least 1 part"); return; }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        material_id: materialId ? Number(materialId) : null,
        sheet_width: Number(sheetWidth),
        sheet_height: Number(sheetHeight),
        blade_kerf: Number(bladeKerf),
        kerf_unit: units,
        cut_orientation: cutOrientation,
        cutting_method: cuttingMethod,
        optimization_priority: optimizationPriority,
        units,
        parts: validParts.map((p) => ({
          label: p.label || "Part",
          length: Number(p.length),
          width: Number(p.width),
          quantity: Number(p.quantity) || 1,
          grain_locked: p.grain_locked,
          edge_banding_l1: p.edge_banding_l1,
          edge_banding_l2: p.edge_banding_l2,
          edge_banding_w1: p.edge_banding_w1,
          edge_banding_w2: p.edge_banding_w2,
          rotation_locked: p.rotation_locked,
        })),
      };

      if (isEdit) {
        await api.put(`/cutlist/jobs/${id}`, payload);
        toast.success("Job updated");
        navigate(`/cutlist/${id}`);
      } else {
        const res = await api.post("/cutlist/jobs", payload);
        toast.success("Job created");
        navigate(`/cutlist/${res.data.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed";
      toast.error(msg);
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Edit Cut Job" : "New Cut Job"}
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>}
      />

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
        {/* Job Settings */}
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Label>Job Name *</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Selvam Kitchen Carcass" />
          </div>
          <div>
            <Label>Material</Label>
            <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={materialId} onChange={(e) => handleMaterialChange(e.target.value)}>
              <option value="">Select material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.sheet_width ? ` (${m.sheet_width}×${m.sheet_height})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Units</Label>
            <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={units} onChange={(e) => setUnits(e.target.value)}>
              <option value="MM">Millimeters (mm)</option>
              <option value="INCHES">Inches</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <div>
            <Label>Sheet Width *</Label>
            <Input className="mt-1" type="number" value={sheetWidth} onChange={(e) => setSheetWidth(e.target.value)} placeholder="2400" />
          </div>
          <div>
            <Label>Sheet Height *</Label>
            <Input className="mt-1" type="number" value={sheetHeight} onChange={(e) => setSheetHeight(e.target.value)} placeholder="1200" />
          </div>
          <div>
            <Label>Blade Kerf</Label>
            <Input className="mt-1" type="number" step="0.5" value={bladeKerf} onChange={(e) => setBladeKerf(e.target.value)} />
          </div>
          <div>
            <Label>Cut Orientation</Label>
            <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={cutOrientation} onChange={(e) => setCutOrientation(e.target.value)}>
              <option value="LENGTH_FIRST">Length First</option>
              <option value="WIDTH_FIRST">Width First</option>
            </select>
          </div>
          <div>
            <Label>Cutting Method</Label>
            <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={cuttingMethod} onChange={(e) => setCuttingMethod(e.target.value)}>
              <option value="GUILLOTINE">Guillotine</option>
              <option value="FREE">Free Cut</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Optimization Priority</Label>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="priority" value="MINIMIZE_WASTE" checked={optimizationPriority === "MINIMIZE_WASTE"}
                onChange={(e) => setOptimizationPriority(e.target.value)} />
              Minimize Waste
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="priority" value="MINIMIZE_CUTS" checked={optimizationPriority === "MINIMIZE_CUTS"}
                onChange={(e) => setOptimizationPriority(e.target.value)} />
              Minimize Cuts
            </label>
          </div>
        </div>

        {/* Parts Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base">Parts</Label>
            <div className="flex gap-2">
              <input ref={csvRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" />CSV Import
              </Button>
              <Button variant="outline" size="sm" onClick={addPart}>
                <Plus className="mr-1 h-3 w-3" />Add Part
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600">
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2">Label</th>
                  <th className="px-2 py-2 w-24">Length</th>
                  <th className="px-2 py-2 w-24">Width</th>
                  <th className="px-2 py-2 w-16">Qty</th>
                  <th className="px-2 py-2 w-14 text-center" title="Grain Direction Lock">Grain</th>
                  <th className="px-2 py-2 w-14 text-center" title="Rotation Lock">Rot Lock</th>
                  <th className="px-2 py-2 w-32 text-center">Edge Banding</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1 text-gray-400 text-center">{i + 1}</td>
                    <td className="px-2 py-1">
                      <Input value={p.label} onChange={(e) => updatePart(i, "label", e.target.value)}
                        placeholder={`Part ${i + 1}`} className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" value={p.length} onChange={(e) => updatePart(i, "length", e.target.value)}
                        placeholder="1924" className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" value={p.width} onChange={(e) => updatePart(i, "width", e.target.value)}
                        placeholder="560" className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" min="1" max="999" value={p.quantity}
                        onChange={(e) => updatePart(i, "quantity", e.target.value)} className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={p.grain_locked}
                        onChange={(e) => updatePart(i, "grain_locked", e.target.checked)} className="rounded" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={p.rotation_locked}
                        onChange={(e) => updatePart(i, "rotation_locked", e.target.checked)} className="rounded" />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1 justify-center text-[10px]">
                        {(["l1", "l2", "w1", "w2"] as const).map((side) => {
                          const key = `edge_banding_${side}` as keyof PartRow;
                          return (
                            <label key={side} className="flex items-center gap-0.5">
                              <input type="checkbox" checked={p[key] as boolean}
                                onChange={(e) => updatePart(i, key, e.target.checked)}
                                className="rounded h-3 w-3" />
                              {side.toUpperCase()}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <button onClick={() => removePart(i)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Job" : "Create Job"}
          </Button>
        </div>
      </div>
    </div>
  );
}
