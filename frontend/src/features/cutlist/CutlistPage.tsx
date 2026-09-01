import { useRef, useState } from "react";
import {
  Play, Plus, Trash2, ChevronDown, ChevronUp,
  Menu, Upload, Download, Settings, FileText, Eraser,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import api from "../../services/api";
import toast from "react-hot-toast";

interface Panel {
  label: string; length: string; width: string; quantity: string;
  grain_locked: boolean; rotation_locked: boolean; enabled: boolean;
}

interface StockSheet {
  length: string; width: string; quantity: string;
}

interface SheetResult {
  sheet_index: number; sheet_length: number; sheet_width: number;
  pieces: { label: string; x: number; y: number; w: number; h: number; rotated: boolean; panel_idx: number }[];
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

const EMPTY_PANEL: Panel = { label: "", length: "", width: "", quantity: "1", grain_locked: false, rotation_locked: false, enabled: true };
const EMPTY_SHEET: StockSheet = { length: "2400", width: "1200", quantity: "10" };

// Sample data for demo
const SAMPLE_PANELS: Panel[] = [
  { ...EMPTY_PANEL, label: "Side Panel", length: "800", width: "560", quantity: "2" },
  { ...EMPTY_PANEL, label: "Top", length: "1924", width: "560", quantity: "2" },
  { ...EMPTY_PANEL, label: "Bottom", length: "1520", width: "560", quantity: "2" },
  { ...EMPTY_PANEL, label: "Shelf", length: "760", width: "350", quantity: "2" },
  { ...EMPTY_PANEL, label: "Back", length: "481", width: "500", quantity: "1" },
];

export function CutlistPage() {
  const [panels, setPanels] = useState<Panel[]>([...SAMPLE_PANELS]);
  const [stockSheets, setStockSheets] = useState<StockSheet[]>([{ ...EMPTY_SHEET }]);

  // Options
  const [bladeKerf, setBladeKerf] = useState("3");
  const [labelsOn, setLabelsOn] = useState(true);
  const [useOneSize, setUseOneSize] = useState(false);
  const [considerGrain, setConsiderGrain] = useState(false);
  const [cuttingMethod, setCuttingMethod] = useState("GUILLOTINE");
  const [optimizationPriority, setOptimizationPriority] = useState("MINIMIZE_WASTE");
  const [cutOrientation, setCutOrientation] = useState("LENGTH_FIRST");
  const [units, setUnits] = useState("MM");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [minTrimDimension, setMinTrimDimension] = useState("0");
  const [stackPanels, setStackPanels] = useState("Auto");

  // UI state
  const [panelsOpen, setPanelsOpen] = useState(true);
  const [sheetsOpen, setSheetsOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [sheetMenuOpen, setSheetMenuOpen] = useState(false);

  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [activeSheet, setActiveSheet] = useState(1);
  const [error, setError] = useState("");

  const csvInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Panel helpers
  const addPanel = () => { setPanels([...panels, { ...EMPTY_PANEL }]); setPanelMenuOpen(false); };
  const removePanel = (i: number) => { if (panels.length > 1) setPanels(panels.filter((_, idx) => idx !== i)); };
  const updatePanel = (i: number, field: keyof Panel, val: string | boolean) => {
    const u = [...panels]; u[i] = { ...u[i], [field]: val }; setPanels(u);
  };
  const clearPanels = () => { setPanels([{ ...EMPTY_PANEL }]); setPanelMenuOpen(false); };
  const enableAll = (v: boolean) => { setPanels(panels.map((p) => ({ ...p, enabled: v }))); setPanelMenuOpen(false); };
  const fillLabelsWithDims = () => {
    setPanels(panels.map((p) => ({ ...p, label: p.length && p.width ? `${p.length}×${p.width}` : p.label })));
    setPanelMenuOpen(false);
  };

  // CSV/Excel import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const imported: Panel[] = [];
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(/[,;\t]/).map((c) => c.trim().replace(/"/g, ""));
        if (i === 0 && (cols[0].toLowerCase() === "label" || cols[0].toLowerCase() === "length")) continue;
        if (cols.length >= 3) {
          const hasLabel = isNaN(Number(cols[0]));
          imported.push({
            ...EMPTY_PANEL,
            label: hasLabel ? cols[0] : `Part ${i}`,
            length: hasLabel ? cols[1] : cols[0],
            width: hasLabel ? cols[2] : cols[1],
            quantity: (hasLabel ? cols[3] : cols[2]) || "1",
          });
        }
      }
      if (imported.length > 0) {
        setPanels(imported);
        toast.success(`Imported ${imported.length} panels`);
      } else {
        toast.error("No valid rows found in file");
      }
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (excelInputRef.current) excelInputRef.current.value = "";
    setPanelMenuOpen(false);
  };

  const handleExportCSV = () => {
    const lines = ["Label,Length,Width,Quantity"];
    panels.forEach((p) => { if (p.length && p.width) lines.push(`${p.label},${p.length},${p.width},${p.quantity}`); });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cutlist_panels.csv"; a.click();
    URL.revokeObjectURL(url);
    setPanelMenuOpen(false);
    toast.success("CSV exported");
  };

  // Stock sheet helpers
  const addSheet = () => setStockSheets([...stockSheets, { ...EMPTY_SHEET }]);
  const removeSheet = (i: number) => { if (stockSheets.length > 1) setStockSheets(stockSheets.filter((_, idx) => idx !== i)); };
  const updateSheet = (i: number, field: keyof StockSheet, val: string) => {
    const u = [...stockSheets]; u[i] = { ...u[i], [field]: val }; setStockSheets(u);
  };

  const handleCalculate = async () => {
    const validPanels = panels.filter((p) => p.enabled && Number(p.length) > 0 && Number(p.width) > 0);
    const validSheets = stockSheets.filter((s) => Number(s.length) > 0 && Number(s.width) > 0);
    if (validPanels.length === 0) { toast.error("Add at least 1 enabled panel"); return; }
    if (validSheets.length === 0) { toast.error("Add at least 1 stock sheet"); return; }

    setCalculating(true); setError(""); setResult(null);
    try {
      const res = await api.post("/cutlist/calculate", {
        panels: validPanels.map((p, i) => ({
          label: p.label || `P${i + 1}`, length: Number(p.length), width: Number(p.width),
          quantity: Number(p.quantity) || 1, grain_locked: p.grain_locked, rotation_locked: p.rotation_locked,
        })),
        stock_sheets: validSheets.map((s) => ({
          length: Number(s.length), width: Number(s.width), quantity: Number(s.quantity) || 10,
        })),
        blade_kerf: Number(bladeKerf) || 0,
        labels_on_panels: labelsOn,
        use_only_one_sheet_size: useOneSize,
        consider_material_grain: considerGrain,
        cutting_method: cuttingMethod,
      });
      setResult(res.data); setActiveSheet(1);
      toast.success(`${res.data.summary.total_panels_placed} panels → ${res.data.summary.total_sheets} sheets`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Calculation failed";
      setError(msg); toast.error(msg);
    } finally { setCalculating(false); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Hidden file inputs */}
      <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
      <input ref={excelInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleImportCSV} className="hidden" />

      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-800 px-4 py-2 flex-shrink-0">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <span className="text-lg">✂</span> CutList Optimizer
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleCalculate} disabled={calculating}
            className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="mr-1.5 h-4 w-4" />
            {calculating ? "Calculating..." : "Calculate"}
          </Button>
          <Button variant="outline" className="border-gray-500 text-gray-200 hover:bg-gray-700"
            onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL ── */}
        <div className="w-[380px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white">

          {/* Panels Section */}
          <SectionHeader title="Panels" icon="📋" open={panelsOpen}
            onToggle={() => setPanelsOpen(!panelsOpen)}
            onMenu={() => setPanelMenuOpen(!panelMenuOpen)} />
          {panelMenuOpen && (
            <DropdownMenu onClose={() => setPanelMenuOpen(false)} items={[
              { label: "Add new line", icon: <Plus className="h-3.5 w-3.5" />, onClick: addPanel },
              { label: "Import from CSV", icon: <Upload className="h-3.5 w-3.5" />, onClick: () => csvInputRef.current?.click() },
              { label: "Import from Excel", icon: <FileText className="h-3.5 w-3.5" />, onClick: () => excelInputRef.current?.click() },
              { label: "Export to CSV", icon: <Download className="h-3.5 w-3.5" />, onClick: handleExportCSV },
              { label: "Enable all", onClick: () => enableAll(true) },
              { label: "Disable all", onClick: () => enableAll(false) },
              { label: "Fill labels with dimensions", onClick: fillLabelsWithDims },
              { label: "Clear", icon: <Eraser className="h-3.5 w-3.5" />, onClick: clearPanels, danger: true },
            ]} />
          )}
          {panelsOpen && (
            <div className="px-2 py-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 font-semibold">
                    <th className="pb-1 w-5"></th>
                    <th className="pb-1 text-left">Label</th>
                    <th className="pb-1 text-left w-[70px]">Length</th>
                    <th className="pb-1 text-left w-[70px]">Width</th>
                    <th className="pb-1 text-left w-10">Qty</th>
                    <th className="pb-1 w-4" title="Grain Direction Lock — prevents rotation">🌾</th>
                    <th className="pb-1 w-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {panels.map((p, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${!p.enabled ? "opacity-40" : ""}`}>
                      <td className="py-px"><input type="checkbox" checked={p.enabled}
                        onChange={(e) => updatePanel(i, "enabled", e.target.checked)} className="rounded h-3 w-3" /></td>
                      <td className="py-px"><input value={p.label} onChange={(e) => updatePanel(i, "label", e.target.value)}
                        placeholder={`P${i+1}`} className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td className="py-px"><input type="number" value={p.length} onChange={(e) => updatePanel(i, "length", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td className="py-px"><input type="number" value={p.width} onChange={(e) => updatePanel(i, "width", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td className="py-px"><input type="number" min="1" value={p.quantity}
                        onChange={(e) => updatePanel(i, "quantity", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50 w-8" /></td>
                      <td className="py-px text-center"><input type="checkbox" checked={p.grain_locked}
                        onChange={(e) => updatePanel(i, "grain_locked", e.target.checked)} className="rounded h-3 w-3" /></td>
                      <td className="py-px"><button onClick={() => removePanel(i)} className="text-gray-200 hover:text-red-500">
                        <Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addPanel} className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 px-0.5">+ Add row</button>
            </div>
          )}

          {/* Stock Sheets Section */}
          <SectionHeader title="Stock sheets" icon="📐" open={sheetsOpen}
            onToggle={() => setSheetsOpen(!sheetsOpen)}
            onMenu={() => setSheetMenuOpen(!sheetMenuOpen)} />
          {sheetMenuOpen && (
            <DropdownMenu onClose={() => setSheetMenuOpen(false)} items={[
              { label: "Add new sheet size", icon: <Plus className="h-3.5 w-3.5" />, onClick: () => { addSheet(); setSheetMenuOpen(false); } },
              { label: "Clear", icon: <Eraser className="h-3.5 w-3.5" />, onClick: () => { setStockSheets([{ ...EMPTY_SHEET }]); setSheetMenuOpen(false); }, danger: true },
            ]} />
          )}
          {sheetsOpen && (
            <div className="px-2 py-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 font-semibold">
                    <th className="pb-1 text-left">Length</th>
                    <th className="pb-1 text-left">Width</th>
                    <th className="pb-1 text-left w-12">Qty</th>
                    <th className="pb-1 w-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {stockSheets.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-px"><input type="number" value={s.length} onChange={(e) => updateSheet(i, "length", e.target.value)}
                        placeholder="2400" className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td className="py-px"><input type="number" value={s.width} onChange={(e) => updateSheet(i, "width", e.target.value)}
                        placeholder="1200" className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50" /></td>
                      <td className="py-px"><input type="number" min="1" value={s.quantity} onChange={(e) => updateSheet(i, "quantity", e.target.value)}
                        className="w-full h-6 text-xs border-0 bg-transparent px-0.5 outline-none focus:bg-blue-50 w-10" /></td>
                      <td className="py-px"><button onClick={() => removeSheet(i)} className="text-gray-200 hover:text-red-500">
                        <Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addSheet} className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 px-0.5">+ Add sheet size</button>
            </div>
          )}

          {/* Quick Options Section */}
          <SectionHeader title="Options" icon="⚙" open={optionsOpen}
            onToggle={() => setOptionsOpen(!optionsOpen)} />
          {optionsOpen && (
            <div className="px-3 py-2 space-y-2.5 text-xs">
              <OptionRow label="Cut / blade / kerf thickness">
                <input type="number" step="0.5" value={bladeKerf} onChange={(e) => setBladeKerf(e.target.value)}
                  className="h-6 w-14 rounded border border-gray-300 px-1.5 text-xs text-right" />
              </OptionRow>
              <ToggleRow label="Labels on panels" checked={labelsOn} onChange={setLabelsOn} />
              <ToggleRow label="Use only one sheet from stock" checked={useOneSize} onChange={setUseOneSize} />
              <ToggleRow label="Consider material (grain)" checked={considerGrain} onChange={setConsiderGrain} />
              <OptionRow label="Cutting method">
                <select value={cuttingMethod} onChange={(e) => setCuttingMethod(e.target.value)}
                  className="h-6 rounded border border-gray-300 px-1 text-xs">
                  <option value="GUILLOTINE">Guillotine</option>
                  <option value="FREE">Free Cut</option>
                </select>
              </OptionRow>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Results ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {!result ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-6xl text-gray-200 mb-4">✂</div>
                <p className="text-gray-400 text-sm">Add panels and stock sheets, then click <strong>Calculate</strong></p>
                <p className="text-gray-300 text-xs mt-2">Sample data is pre-filled — try it now</p>
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

              {/* Sheet Tabs */}
              {result.sheets.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {result.sheets.map((s) => (
                    <button key={s.sheet_index} onClick={() => setActiveSheet(s.sheet_index)}
                      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                        activeSheet === s.sheet_index
                          ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}>
                      Sheet {s.sheet_index}
                      <span className="ml-1 text-[10px] opacity-70">{s.waste_percent.toFixed(0)}%w</span>
                    </button>
                  ))}
                </div>
              )}

              {/* SVG Diagram */}
              {result.sheets.map((s) =>
                s.sheet_index === activeSheet ? (
                  <div key={s.sheet_index} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div dangerouslySetInnerHTML={{ __html: s.svg }} />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.pieces.map((p, i) => (
                        <span key={i} className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          {p.label} {p.w}×{p.h}{p.rotated ? " ↻" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <SettingsRow label="Optimization priority">
              <select value={optimizationPriority} onChange={(e) => setOptimizationPriority(e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="MINIMIZE_WASTE">Least wasted area</option>
                <option value="MINIMIZE_CUTS">Minimize cuts</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Cut Orientation">
              <select value={cutOrientation} onChange={(e) => setCutOrientation(e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="LENGTH_FIRST">Length First</option>
                <option value="WIDTH_FIRST">Width First</option>
                <option value="OPTIMAL">Optimal</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Units">
              <select value={units} onChange={(e) => setUnits(e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="MM">Millimeters (mm)</option>
                <option value="INCHES">Inches</option>
                <option value="GENERIC">Generic</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Decimal places">
              <input type="number" min="0" max="4" value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </SettingsRow>
            <SettingsRow label="Minimum trim dimension">
              <input type="number" min="0" value={minTrimDimension} onChange={(e) => setMinTrimDimension(e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </SettingsRow>
            <SettingsRow label="Stack panels with same layout">
              <select value={stackPanels} onChange={(e) => setStackPanels(e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="Auto">Auto</option>
                <option value="Always">Always</option>
                <option value="Never">Never</option>
              </select>
            </SettingsRow>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Ok</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub Components ──

function SectionHeader({ title, icon, open, onToggle, onMenu }: {
  title: string; icon: string; open: boolean; onToggle: () => void; onMenu?: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-100 border-b border-gray-200 px-3 py-1.5">
      <button onClick={onToggle} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900">
        <span>{icon}</span> {title}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {onMenu && (
        <button onClick={onMenu} className="p-0.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200">
          <Menu className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function DropdownMenu({ items, onClose }: {
  items: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="relative z-50">
        <div className="absolute right-2 top-0 w-52 rounded-md border border-gray-200 bg-white shadow-lg py-1">
          {items.map((item, i) => (
            <button key={i} onClick={item.onClick}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${
                item.danger ? "text-red-600" : "text-gray-700"
              }`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <button onClick={() => onChange(!checked)}
        className={`relative h-4 w-8 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform shadow-sm ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      {children}
    </div>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </div>
  );
}

function Stat({ label, value, color = "indigo" }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = {
    indigo: "text-indigo-700", green: "text-green-700", amber: "text-amber-700", red: "text-red-700",
  };
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${c[color] || c.indigo}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
