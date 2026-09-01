import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Play, Trash2, Save, Download, ChevronDown, ChevronUp,
  Menu, Settings, Scissors,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import api from "../../services/api";
import toast from "react-hot-toast";

interface Panel {
  label: string; length: string; width: string; quantity: string;
  grain_locked: boolean; rotation_locked: boolean; enabled: boolean;
}

interface StockSheet { length: string; width: string; quantity: string; }
interface RawMaterial { id: number; name: string; sku: string; unit: string; current_stock: number; last_purchase_rate: number; }
interface Category { id: number; name: string; }

interface SheetResult {
  sheet_index: number; sheet_length: number; sheet_width: number;
  pieces: { label: string; x: number; y: number; w: number; h: number; rotated: boolean; panel_idx?: number }[];
  used_area: number; waste_area: number; waste_percent: number; svg: string;
}

interface CalcResult {
  sheets: SheetResult[];
  summary: {
    total_sheets: number; total_panels_placed: number; total_panels_requested: number;
    efficiency_percent: number; waste_percent: number;
    total_used_area: number; total_sheet_area: number; total_waste_area: number;
  };
}

const E_PANEL: Panel = { label: "", length: "", width: "", quantity: "1", grain_locked: false, rotation_locked: false, enabled: true };
const E_SHEET: StockSheet = { length: "", width: "", quantity: "" };
const round2 = (n: number) => Math.round(n * 100) / 100;

// Same palette as the backend-rendered preview SVG, kept in sync so recolored
// pieces still line up across the quick preview, the saved layout, and the PDF.
const SHEET_COLORS = [
  "#dbeafe", "#fce7f3", "#fef3c7", "#d1fae5", "#e0e7ff",
  "#ede9fe", "#fee2e2", "#ccfbf1", "#ffedd5", "#cffafe",
  "#ecfccb", "#f5d0fe", "#fed7aa", "#a5f3fc", "#d9f99d",
];
const SHEET_BORDERS = [
  "#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#6366f1",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
  "#84cc16", "#e879f9", "#fb923c", "#22d3ee", "#a3e635",
];

export function CutPlannerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const linkedWo = searchParams.get("wo_number") || "";
  const piecesParam = searchParams.get("pieces") || "";

  // Mode: quick (no save) or job (saves CO + WO)
  const [mode, setMode] = useState<"quick" | "job">(linkedWo ? "job" : "quick");

  // Panels & Sheets — auto-fill from URL if coming from Elevation page, otherwise blank
  const initPanels = (): Panel[] => {
    if (piecesParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(piecesParam));
        return parsed.map((p: { label: string; length: number; width: number; quantity: number }) => ({
          ...E_PANEL, label: p.label, length: String(p.length), width: String(p.width), quantity: String(p.quantity),
        }));
      } catch { /* ignore parse errors */ }
    }
    return [{ ...E_PANEL }];
  };
  const [panels, setPanels] = useState<Panel[]>(initPanels);
  const [stockSheets, setStockSheets] = useState<StockSheet[]>([{ ...E_SHEET }]);

  // Options
  const [bladeKerf, setBladeKerf] = useState("3");
  const [labelsOn, setLabelsOn] = useState(true);
  const [useOneSize, setUseOneSize] = useState(false);
  const [considerGrain, setConsiderGrain] = useState(false);
  const [cuttingMethod, setCuttingMethod] = useState("GUILLOTINE");

  // Job mode fields
  const [jobType, setJobType] = useState<"OWN" | "CONTRACT">("OWN");
  const [projectLabel, setProjectLabel] = useState(linkedWo || "");
  const [companyName, setCompanyName] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [jobReference, setJobReference] = useState("");
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [materialId, setMaterialId] = useState("");

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const catRes = await api.get("/item-categories");
        const sheetCat = (catRes.data as Category[]).find((c) => c.name === "Sheet Materials");
        const params = sheetCat ? `&category_id=${sheetCat.id}` : "";
        const matRes = await api.get(`/raw-materials?per_page=100${params}`);
        setMaterials(matRes.data.items || []);
      } catch {
        // Fall back to the full material list if categories can't be loaded.
        api.get("/raw-materials?per_page=100").then((res) => setMaterials(res.data.items || [])).catch(() => {});
      }
    };
    loadMaterials();
  }, []);

  // UI state
  const [panelsOpen, setPanelsOpen] = useState(true);
  const [sheetsOpen, setSheetsOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);

  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [activeSheet, setActiveSheet] = useState(1);
  const [error, setError] = useState("");
  const [previewOrientation, setPreviewOrientation] = useState<"landscape" | "portrait">("landscape");

  const csvRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  // Panel helpers
  const addPanel = () => { setPanels([...panels, { ...E_PANEL }]); setPanelMenuOpen(false); };
  const removePanel = (i: number) => { if (panels.length > 1) setPanels(panels.filter((_, idx) => idx !== i)); };
  const updatePanel = (i: number, field: keyof Panel, val: string | boolean) => {
    const u = [...panels]; u[i] = { ...u[i], [field]: val }; setPanels(u);
  };
  const clearPanels = () => { setPanels([{ ...E_PANEL }]); setPanelMenuOpen(false); };
  const enableAll = (v: boolean) => { setPanels(panels.map((p) => ({ ...p, enabled: v }))); setPanelMenuOpen(false); };
  const fillLabels = () => {
    setPanels(panels.map((p) => ({ ...p, label: p.length && p.width ? `${p.length}×${p.width}` : p.label })));
    setPanelMenuOpen(false);
  };

  // CSV import/export
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split("\n").filter((l) => l.trim());
      const imported: Panel[] = [];
      for (let i = 0; i < lines.length; i++) {
        const c = lines[i].split(/[,;\t]/).map((s) => s.trim().replace(/"/g, ""));
        if (i === 0 && isNaN(Number(c[0])) && c[0].toLowerCase() !== "label") continue;
        if (i === 0 && c[0].toLowerCase() === "label") continue;
        if (c.length >= 3) {
          const hasLabel = isNaN(Number(c[0]));
          imported.push({ ...E_PANEL, label: hasLabel ? c[0] : `P${i}`, length: hasLabel ? c[1] : c[0], width: hasLabel ? c[2] : c[1], quantity: (hasLabel ? c[3] : c[2]) || "1" });
        }
      }
      if (imported.length) { setPanels(imported); toast.success(`Imported ${imported.length} panels`); }
    };
    reader.readAsText(file);
    if (csvRef.current) csvRef.current.value = "";
    setPanelMenuOpen(false);
  };
  const exportCSV = () => {
    const rows = ["Label,Length,Width,Quantity", ...panels.filter((p) => p.length && p.width).map((p) => `${p.label},${p.length},${p.width},${p.quantity}`)];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" })); a.download = "cutlist.csv"; a.click();
    setPanelMenuOpen(false);
  };

  // AI Vision: scan a photo of a handwritten/printed cutting list
  const handleScanCutlist = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPanelMenuOpen(false);
    if (!file) return;

    setScanning(true);
    const toastId = toast.loading("Reading cutting list...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/cutlist/ocr-panels", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const scanned = (res.data.panels || []) as Array<{ label: string; length: number; width: number; quantity: number }>;
      if (scanned.length) {
        setPanels(scanned.map((p) => ({
          ...E_PANEL, label: p.label, length: String(p.length), width: String(p.width), quantity: String(p.quantity),
        })));
        toast.success(`Scanned ${scanned.length} panel${scanned.length !== 1 ? "s" : ""} — review before calculating`, { id: toastId });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Couldn't read the cutting list";
      toast.error(msg, { id: toastId });
    } finally {
      setScanning(false);
      if (ocrRef.current) ocrRef.current.value = "";
    }
  };

  // Stock sheet helpers
  const addSheet = () => setStockSheets([...stockSheets, { ...E_SHEET }]);
  const removeSheet = (i: number) => { if (stockSheets.length > 1) setStockSheets(stockSheets.filter((_, idx) => idx !== i)); };
  const updateSheet = (i: number, field: keyof StockSheet, val: string) => {
    const u = [...stockSheets]; u[i] = { ...u[i], [field]: val }; setStockSheets(u);
  };

  const getValidPanels = () => panels.filter((p) => p.enabled && Number(p.length) > 0 && Number(p.width) > 0);
  const getValidSheets = () => stockSheets.filter((s) => Number(s.length) > 0 && Number(s.width) > 0);

  // Calculate
  const handleCalculate = async () => {
    const vp = getValidPanels(); const vs = getValidSheets();
    if (!vp.length) { toast.error("Add at least 1 panel"); return; }
    if (!vs.length) { toast.error("Add at least 1 stock sheet"); return; }
    setCalculating(true); setError(""); setResult(null);
    try {
      const res = await api.post("/cutlist/calculate", {
        panels: vp.map((p, i) => ({ label: p.label || `P${i+1}`, length: Number(p.length), width: Number(p.width), quantity: Number(p.quantity) || 1, grain_locked: p.grain_locked, rotation_locked: p.rotation_locked })),
        stock_sheets: vs.map((s) => ({ length: Number(s.length), width: Number(s.width), quantity: Number(s.quantity) || 10 })),
        blade_kerf: Number(bladeKerf) || 0, labels_on_panels: labelsOn, use_only_one_sheet_size: useOneSize, consider_material_grain: considerGrain, cutting_method: cuttingMethod,
      });
      setResult(res.data); setActiveSheet(1);
      toast.success(`${res.data.summary.total_panels_placed} panels → ${res.data.summary.total_sheets} sheets`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed";
      setError(msg); toast.error(msg);
    } finally { setCalculating(false); }
  };

  // Save as Cut Order (job mode only)
  const handleSave = async () => {
    if (!result) { toast.error("Calculate first"); return; }
    if (!materialId) { toast.error("Select a material"); return; }
    const material = materials.find((m) => m.id === parseInt(materialId));
    if (!material) { toast.error("Select a material"); return; }
    const vp = getValidPanels(); const vs = getValidSheets();
    if (!vs.length) return;
    setSaving(true);
    try {
      const totalSheets = result.summary.total_sheets;
      const costPerSheet = material.last_purchase_rate || 0;
      const totalCost = round2(totalSheets * costPerSheet);
      const sufficientStock = material.current_stock >= totalSheets;

      // Replay-ready layout so the detail page shows exactly what was calculated
      // here, instead of a backend recompute that can't reproduce a multi-sheet-size
      // optimization from a single raw_material_id.
      const firstSheet = result.sheets[0];
      const layoutResult = {
        sheets: result.sheets.map((s) => ({
          sheet_num: s.sheet_index,
          placed_pieces: s.pieces.map((p, i) => ({
            label: p.label, x: p.x, y: p.y, width: p.w, height: p.h, rotated: p.rotated,
            piece_id: p.panel_idx ?? i,
          })),
          piece_count: s.pieces.length,
          used_area_mm2: s.used_area,
          waste_area_mm2: s.waste_area,
          waste_percent: s.waste_percent,
        })),
        summary: {
          sheet_size_mm: { width: firstSheet?.sheet_length ?? 0, height: firstSheet?.sheet_width ?? 0 },
          total_sheets: totalSheets,
          total_pieces: result.summary.total_panels_placed,
          total_piece_area_mm2: result.summary.total_used_area,
          total_sheet_area_mm2: result.summary.total_sheet_area,
          total_waste_mm2: result.summary.total_waste_area,
          waste_percent: result.summary.waste_percent,
          cost_per_sheet: costPerSheet,
          total_cost: totalCost,
          waste_cost: round2((result.summary.waste_percent / 100) * totalCost),
          available_stock: material.current_stock,
          sufficient_stock: sufficientStock,
          material_name: material.name,
          material_sku: material.sku,
          kerf_mm: Number(bladeKerf) || 0,
        },
      };

      if (!sufficientStock) {
        toast(`Only ${material.current_stock} ${material.unit} in stock — ${totalSheets} sheets needed`, { icon: "⚠️" });
      }

      await api.post("/cutting/save", {
        raw_material_id: material.id,
        label: projectLabel,
        pieces: vp.map((p, i) => ({ label: p.label || `P${i+1}`, width: Number(p.length), height: Number(p.width), qty: Number(p.quantity) || 1 })),
        total_sheets: totalSheets,
        total_piece_area_mm2: result.summary.total_used_area,
        total_sheet_area_mm2: result.summary.total_sheet_area,
        total_waste_mm2: result.summary.total_waste_area,
        waste_percent: result.summary.waste_percent,
        cost_per_sheet: costPerSheet,
        total_cost: totalCost,
        job_type: jobType,
        company_name: jobType === "CONTRACT" ? companyName : null,
        company_contact: jobType === "CONTRACT" ? companyContact : null,
        company_phone: jobType === "CONTRACT" ? companyPhone : null,
        job_reference: jobType === "CONTRACT" ? jobReference : null,
        layout_result: layoutResult,
      });
      toast.success("Cut Order saved!");
      navigate("/cut-orders");
    } catch { /* handled */ } finally { setSaving(false); }
  };

  // PDF download
  const handlePDF = async () => {
    if (!result) return;
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("l", "mm", "a4");
      const pageW = 297; const pageH = 210; const margin = 10;
      for (let si = 0; si < result.sheets.length; si++) {
        if (si > 0) pdf.addPage();
        const sheet = result.sheets[si];
        const sl = sheet.sheet_length; const sw = sheet.sheet_width;

        // Header
        pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
        pdf.text(`Sheet ${sheet.sheet_index} of ${result.sheets.length}`, pageW / 2, margin + 6, { align: "center" });
        pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
        pdf.text(`${sl} × ${sw} mm  |  ${sheet.pieces.length} pieces  |  Waste: ${sheet.waste_percent.toFixed(1)}%`, pageW / 2, margin + 13, { align: "center" });

        // Drawing area
        const drawY = margin + 18;
        const drawAreaW = pageW - margin * 2;
        const drawAreaH = pageH - drawY - margin - 5;
        const scale = Math.min(drawAreaW / sl, drawAreaH / sw);
        const dw = sl * scale; const dh = sw * scale;
        const dx = margin + (drawAreaW - dw) / 2;

        pdf.setDrawColor(0); pdf.setLineWidth(0.5);
        pdf.rect(dx, drawY, dw, dh);
        pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
        pdf.text(`${sl} mm`, dx + dw / 2, drawY - 3, { align: "center" });
        pdf.text(`${sw} mm`, dx - 4, drawY + dh / 2, { align: "center", angle: 90 });

        const COLORS = ["#3b82f6","#ec4899","#f59e0b","#10b981","#6366f1","#8b5cf6","#ef4444","#14b8a6"];
        sheet.pieces.forEach((p, pi) => {
          const px = dx + p.x * scale; const py = drawY + p.y * scale;
          const pw = p.w * scale; const ph = p.h * scale;
          const c = COLORS[(p.panel_idx ?? pi) % COLORS.length];
          const r = parseInt(c.slice(1,3),16); const g = parseInt(c.slice(3,5),16); const b = parseInt(c.slice(5,7),16);
          pdf.setFillColor(r+(255-r)*0.75, g+(255-g)*0.75, b+(255-b)*0.75);
          pdf.setDrawColor(r, g, b); pdf.setLineWidth(0.3);
          pdf.rect(px, py, pw, ph, "FD");
          if (Math.min(pw, ph) > 6) {
            const fs = Math.max(7, Math.min(Math.min(pw,ph)*0.4, 18));
            pdf.setFontSize(fs); pdf.setFont("helvetica","bold"); pdf.setTextColor(r,g,b);
            pdf.text(p.label, px+pw/2, py+ph/2, { align: "center" });
            if (pw > 12 && ph > 8) {
              const dfs = Math.max(5, fs*0.55);
              pdf.setFontSize(dfs); pdf.setTextColor(60,60,60);
              pdf.text(`${p.w.toFixed(0)}×${p.h.toFixed(0)}`, px+pw/2, py+ph/2+fs*0.65, { align: "center" });
            }
          }
        });
        pdf.setTextColor(0);
        pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(130);
        pdf.text("Generated by DecoTrack", pageW/2, pageH-margin+2, { align: "center" });
        pdf.text(`Page ${si+1} of ${result.sheets.length}`, pageW-margin, pageH-margin+2, { align: "right" });
      }
      pdf.save(`CutPlan-${projectLabel || "layout"}.pdf`);
      toast.success("PDF downloaded!");
    } catch (e) { console.error(e); toast.error("PDF failed"); }
  };

  return (
    <div className="h-full flex flex-col">
      <input ref={csvRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleCSV} className="hidden" />
      <input ref={ocrRef} type="file" accept="image/*" capture="environment" onChange={handleScanCutlist} className="hidden" />

      {/* Top Bar */}
      <div className="flex items-center justify-between border-b bg-gray-800 px-4 py-2 flex-shrink-0">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Scissors className="h-5 w-5" /> Cut Planner
        </h1>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-600">
            <button onClick={() => setMode("quick")}
              className={`px-3 py-1 text-xs font-medium ${mode === "quick" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300"}`}>
              Quick Mode
            </button>
            <button onClick={() => setMode("job")}
              className={`px-3 py-1 text-xs font-medium ${mode === "job" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300"}`}>
              Job Mode
            </button>
          </div>
          <Button onClick={handleCalculate} disabled={calculating} className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="mr-1.5 h-4 w-4" /> {calculating ? "Calculating..." : "Calculate"}
          </Button>
          {mode === "job" && result && (
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving..." : "Save Order"}
            </Button>
          )}
          {result && (
            <Button variant="outline" className="border-gray-500 text-gray-200 hover:bg-gray-700" onClick={handlePDF}>
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          )}
          <Button variant="outline" className="border-gray-500 text-gray-200 hover:bg-gray-700" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-[380px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white">

          {/* Job Info (job mode only) */}
          {mode === "job" && (
            <div className="border-b border-gray-200 px-3 py-2 space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-gray-500">Site / Project Name</label>
                <input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)}
                  placeholder="e.g. Selvam Site Carcass" className="w-full h-7 text-xs border border-gray-200 rounded px-2 mt-0.5" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500">Material</label>
                <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}
                  className="w-full h-7 text-xs border border-gray-200 rounded px-2 mt-0.5 bg-white">
                  <option value="">Select material</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.sku}) — stock {m.current_stock} {m.unit}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1.5"><input type="radio" name="jt" checked={jobType === "OWN"} onChange={() => setJobType("OWN")} className="h-3 w-3" /> Own</label>
                <label className="flex items-center gap-1.5"><input type="radio" name="jt" checked={jobType === "CONTRACT"} onChange={() => setJobType("CONTRACT")} className="h-3 w-3" /> Contract</label>
              </div>
              {jobType === "CONTRACT" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" className="h-6 text-xs border border-gray-200 rounded px-1.5" />
                  <input value={companyContact} onChange={(e) => setCompanyContact(e.target.value)} placeholder="Contact" className="h-6 text-xs border border-gray-200 rounded px-1.5" />
                  <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="Phone" className="h-6 text-xs border border-gray-200 rounded px-1.5" />
                  <input value={jobReference} onChange={(e) => setJobReference(e.target.value)} placeholder="Their Ref #" className="h-6 text-xs border border-gray-200 rounded px-1.5" />
                </div>
              )}
            </div>
          )}

          {/* Panels */}
          <SectionHeader title={scanning ? "Panels (scanning cutting list...)" : "Panels"} open={panelsOpen} onToggle={() => setPanelsOpen(!panelsOpen)}
            onMenu={() => setPanelMenuOpen(!panelMenuOpen)} />
          {panelMenuOpen && (
            <MenuDropdown onClose={() => setPanelMenuOpen(false)} items={[
              { label: "Add new line", onClick: addPanel },
              { label: "Scan cutting list photo (AI)", onClick: () => { ocrRef.current?.click(); setPanelMenuOpen(false); } },
              { label: "Import from CSV / Excel", onClick: () => { csvRef.current?.click(); setPanelMenuOpen(false); } },
              { label: "Export to CSV", onClick: exportCSV },
              { label: "Enable all", onClick: () => enableAll(true) },
              { label: "Disable all", onClick: () => enableAll(false) },
              { label: "Fill labels with dimensions", onClick: fillLabels },
              { label: "Clear all", onClick: clearPanels, danger: true },
            ]} />
          )}
          {panelsOpen && (
            <div className="px-2 py-1">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 font-semibold">
                  <th className="w-5"></th><th className="text-left">Label</th><th className="text-left w-[68px]">Length</th>
                  <th className="text-left w-[68px]">Width</th><th className="text-left w-10">Qty</th>
                  <th className="w-4" title="Grain Lock">🌾</th><th className="w-3"></th>
                </tr></thead>
                <tbody>
                  {panels.map((p, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${!p.enabled ? "opacity-35" : ""}`}>
                      <td><input type="checkbox" checked={p.enabled} onChange={(e) => updatePanel(i, "enabled", e.target.checked)} className="h-3 w-3 rounded" /></td>
                      <td><input value={p.label} onChange={(e) => updatePanel(i, "label", e.target.value)} placeholder={`P${i+1}`}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td><input type="number" value={p.length} onChange={(e) => updatePanel(i, "length", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td><input type="number" value={p.width} onChange={(e) => updatePanel(i, "width", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td><input type="number" min="1" value={p.quantity} onChange={(e) => updatePanel(i, "quantity", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50 w-8" /></td>
                      <td className="text-center"><input type="checkbox" checked={p.grain_locked} onChange={(e) => updatePanel(i, "grain_locked", e.target.checked)} className="h-3 w-3 rounded" /></td>
                      <td><button onClick={() => removePanel(i)} className="text-gray-200 hover:text-red-500"><Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addPanel} className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700">+ Add row</button>
            </div>
          )}

          {/* Stock Sheets */}
          <SectionHeader title="Stock sheets" open={sheetsOpen} onToggle={() => setSheetsOpen(!sheetsOpen)} />
          {sheetsOpen && (
            <div className="px-2 py-1">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 font-semibold">
                  <th className="text-left">Length</th><th className="text-left">Width</th><th className="text-left w-12">Qty</th><th className="w-3"></th>
                </tr></thead>
                <tbody>
                  {stockSheets.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td><input type="number" value={s.length} onChange={(e) => updateSheet(i, "length", e.target.value)} placeholder="2400"
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td><input type="number" value={s.width} onChange={(e) => updateSheet(i, "width", e.target.value)} placeholder="1200"
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td><input type="number" min="1" value={s.quantity} onChange={(e) => updateSheet(i, "quantity", e.target.value)} placeholder="10"
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50 w-10" /></td>
                      <td><button onClick={() => removeSheet(i)} className="text-gray-200 hover:text-red-500"><Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addSheet} className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700">+ Add sheet size</button>
            </div>
          )}

          {/* Options */}
          <SectionHeader title="Options" open={optionsOpen} onToggle={() => setOptionsOpen(!optionsOpen)} />
          {optionsOpen && (
            <div className="px-3 py-2 space-y-2.5 text-xs">
              <OptRow label="Cut / blade / kerf thickness">
                <input type="number" step="0.5" value={bladeKerf} onChange={(e) => setBladeKerf(e.target.value)}
                  className="h-6 w-14 rounded border border-gray-300 px-1.5 text-xs text-right" />
              </OptRow>
              <Toggle label="Labels on panels" checked={labelsOn} onChange={setLabelsOn} />
              <Toggle label="Use only one sheet from stock" checked={useOneSize} onChange={setUseOneSize} />
              <Toggle label="Consider material (grain)" checked={considerGrain} onChange={setConsiderGrain} />
              <OptRow label="Cutting method">
                <select value={cuttingMethod} onChange={(e) => setCuttingMethod(e.target.value)}
                  className="h-6 rounded border border-gray-300 px-1 text-xs">
                  <option value="GUILLOTINE">Guillotine</option>
                  <option value="FREE">Free Cut</option>
                </select>
              </OptRow>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {!result ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Scissors className="mx-auto h-16 w-16 text-gray-200 mb-4" />
                <p className="text-gray-400 text-sm">Add panels and stock sheets, then click <strong>Calculate</strong></p>
                <p className="text-gray-300 text-xs mt-2">
                  {mode === "quick" ? "Quick Mode — results are not saved" : "Job Mode — saves as Cut Order (CO-xxxx)"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-5 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <Stat label="Sheets" value={result.summary.total_sheets} />
                <Stat label="Panels" value={result.summary.total_panels_placed} />
                <Stat label="Efficiency" value={`${result.summary.efficiency_percent}%`}
                  color={result.summary.efficiency_percent >= 80 ? "green" : result.summary.efficiency_percent >= 60 ? "amber" : "red"} />
                <Stat label="Waste" value={`${result.summary.waste_percent}%`} />
                <Stat label="Waste Area" value={`${result.summary.total_waste_area.toFixed(0)} mm²`} />
              </div>

              {/* Sheet Tabs + orientation toggle */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {result.sheets.length > 1 ? (
                  <div className="flex gap-1 flex-wrap">
                    {result.sheets.map((s) => (
                      <button key={s.sheet_index} onClick={() => setActiveSheet(s.sheet_index)}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                          activeSheet === s.sheet_index ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}>
                        Sheet {s.sheet_index} <span className="ml-1 text-[10px] opacity-70">{s.waste_percent.toFixed(0)}%w</span>
                      </button>
                    ))}
                  </div>
                ) : <div />}
                <div className="flex rounded-md border border-gray-200 overflow-hidden">
                  <button onClick={() => setPreviewOrientation("landscape")}
                    className={`px-3 py-1 text-xs font-medium ${previewOrientation === "landscape" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                    Landscape
                  </button>
                  <button onClick={() => setPreviewOrientation("portrait")}
                    className={`px-3 py-1 text-xs font-medium border-l border-gray-200 ${previewOrientation === "portrait" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                    Portrait
                  </button>
                </div>
              </div>

              {/* Sheet preview */}
              {result.sheets.map((s) => s.sheet_index === activeSheet ? (
                <div key={s.sheet_index} className="rounded-lg border border-gray-200 bg-white p-3">
                  <SheetPreview sheet={s} totalSheets={result.sheets.length} orientation={previewOrientation} />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.pieces.map((p, i) => (
                      <span key={i} className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {p.label} {p.w}×{p.h}{p.rotated ? " ↻" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <SettRow label="Optimization priority">
              <select className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option>Least wasted area</option><option>Minimize cuts</option>
              </select>
            </SettRow>
            <SettRow label="Cut Orientation">
              <select className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option>Length First</option><option>Width First</option><option>Optimal</option>
              </select>
            </SettRow>
            <SettRow label="Units">
              <select className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option>Millimeters (mm)</option><option>Inches</option>
              </select>
            </SettRow>
            <SettRow label="Decimal places">
              <input type="number" min="0" max="4" defaultValue="2" className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </SettRow>
            <SettRow label="Minimum trim dimension">
              <input type="number" min="0" defaultValue="0" className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </SettRow>
            <SettRow label="Stack panels with same layout">
              <select className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option>Auto</option><option>Always</option><option>Never</option>
              </select>
            </SettRow>
          </div>
          <DialogFooter><Button onClick={() => setShowSettings(false)}>Ok</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHeader({ title, open, onToggle, onMenu }: { title: string; open: boolean; onToggle: () => void; onMenu?: () => void }) {
  return (
    <div className="flex items-center justify-between bg-gray-100 border-b border-gray-200 px-3 py-1.5">
      <button onClick={onToggle} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {title}
      </button>
      {onMenu && <button onClick={onMenu} className="p-0.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200"><Menu className="h-4 w-4" /></button>}
    </div>
  );
}

function MenuDropdown({ items, onClose }: { items: { label: string; onClick: () => void; danger?: boolean }[]; onClose: () => void }) {
  return (<><div className="fixed inset-0 z-40" onClick={onClose} /><div className="relative z-50"><div className="absolute right-2 top-0 w-52 rounded-md border border-gray-200 bg-white shadow-lg py-1">
    {items.map((it, i) => (<button key={i} onClick={it.onClick} className={`flex w-full items-center px-3 py-1.5 text-xs hover:bg-gray-50 ${it.danger ? "text-red-600" : "text-gray-700"}`}>{it.label}</button>))}
  </div></div></>);
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (<div className="flex items-center justify-between"><span className="text-gray-600">{label}</span>
    <button onClick={() => onChange(!checked)} className={`relative h-4 w-8 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-gray-300"}`}>
      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button></div>);
}

function OptRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-gray-600">{label}</span>{children}</div>;
}

function SettRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">{label}</span>{children}</div>;
}

function Stat({ label, value, color = "indigo" }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = { indigo: "text-indigo-700", green: "text-green-700", amber: "text-amber-700", red: "text-red-700" };
  return <div className="text-center"><p className={`text-lg font-bold ${c[color] || c.indigo}`}>{value}</p><p className="text-[10px] text-gray-400">{label}</p></div>;
}

// Draws the sheet as calculated (landscape) or rotated 90° CW (portrait, long
// side vertical) — same rotation convention as the saved Cut Order view.
function SheetPreview({ sheet, totalSheets, orientation }: { sheet: SheetResult; totalSheets: number; orientation: "landscape" | "portrait" }) {
  const pad = 40;
  const sheetL = sheet.sheet_length; // original long side
  const sheetW = sheet.sheet_width;  // original short side
  const rotate = orientation === "portrait";
  const drawW = rotate ? sheetW : sheetL;
  const drawH = rotate ? sheetL : sheetW;
  const viewW = drawW + pad * 2;
  const viewH = drawH + pad * 2 + 25;
  const oy = 25;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full" style={{ maxHeight: "600px" }} preserveAspectRatio="xMidYMid meet">
      <text x={viewW / 2} y={16} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#111">
        Sheet {sheet.sheet_index}/{totalSheets} · {drawW}×{drawH} mm · Waste: {sheet.waste_percent.toFixed(1)}%
      </text>

      <rect x={pad} y={pad + oy} width={drawW} height={drawH} fill="#f3f4f6" stroke="#374151" strokeWidth={2} />
      <defs>
        <pattern id={`ph-${sheet.sheet_index}`} patternUnits="userSpaceOnUse" width="8" height="8">
          <path d="M0,8 L8,0" stroke="#e5e7eb" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x={pad} y={pad + oy} width={drawW} height={drawH} fill={`url(#ph-${sheet.sheet_index})`} />

      <text x={pad + drawW / 2} y={pad + oy - 6} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#374151">{drawW} mm</text>
      <text x={pad - 8} y={pad + oy + drawH / 2} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#374151"
        transform={`rotate(-90, ${pad - 8}, ${pad + oy + drawH / 2})`}>{drawH} mm</text>

      {sheet.pieces.map((piece, i) => {
        // Portrait applies a 90° CW rotation: (x, y, w, h) -> new rect below.
        const px = pad + (rotate ? (sheetW - piece.y - piece.h) : piece.x);
        const py = pad + oy + (rotate ? piece.x : piece.y);
        const pw = rotate ? piece.h : piece.w;
        const ph = rotate ? piece.w : piece.h;
        const cidx = (piece.panel_idx ?? i) % SHEET_COLORS.length;
        const fill = SHEET_COLORS[cidx];
        const stroke = SHEET_BORDERS[cidx];
        const showLabel = pw > 35 && ph > 35;
        const fs = Math.max(7, Math.min(Math.min(pw, ph) * 0.14, 13));

        return (
          <g key={i}>
            <rect x={px} y={py} width={pw} height={ph} fill={fill} stroke={stroke} strokeWidth={1.5} />
            {showLabel && (
              <>
                <text x={px + pw / 2} y={py + ph / 2 - fs * 0.2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={fs} fontWeight="bold" fill={stroke}>{piece.label}</text>
                {pw > 50 && ph > 25 && (
                  <text x={px + pw / 2} y={py + ph / 2 + fs * 0.6} textAnchor="middle" fontSize={Math.max(5, fs * 0.6)} fill="#666">
                    {pw.toFixed(0)}×{ph.toFixed(0)}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
