import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Send, Download, Ruler } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import api from "../../services/api";
import toast from "react-hot-toast";

interface Piece { label: string; length: number; width: number; quantity: number; }
interface ElevResult {
  front_view_svg: string; side_view_svg: string;
  pieces: Piece[];
  summary: { total_pieces: number; total_area_mm2: number; product_label: string; dimensions: string };
}

const PRODUCTS = [
  { value: "cupboard", label: "Cupboard / Wardrobe", hasDoorsField: true, hasPartitions: true, hasDrawers: false },
  { value: "kitchen_cabinet", label: "Kitchen Cabinet", hasDoorsField: true, hasPartitions: false, hasDrawers: true },
  { value: "tv_unit", label: "TV Unit", hasDoorsField: true, hasPartitions: true, hasDrawers: false },
  { value: "bookshelf", label: "Bookshelf / Shelf Unit", hasDoorsField: false, hasPartitions: false, hasDrawers: false },
  { value: "study_table", label: "Study Table / Dressing Table", hasDoorsField: false, hasPartitions: false, hasDrawers: true },
  { value: "shoe_rack", label: "Shoe Rack", hasDoorsField: true, hasPartitions: false, hasDrawers: false },
];

const DEFAULTS: Record<string, Record<string, string>> = {
  cupboard: { width: "1800", height: "2100", depth: "550", doors: "3", shelves: "2", partitions: "2" },
  kitchen_cabinet: { width: "600", height: "720", depth: "550", doors: "2", shelves: "1", drawers: "0" },
  tv_unit: { width: "1500", height: "500", depth: "400", doors: "2", shelves: "1", partitions: "1" },
  bookshelf: { width: "800", height: "1800", depth: "300", shelves: "5" },
  study_table: { width: "1200", height: "750", depth: "600", drawers: "3" },
  shoe_rack: { width: "800", height: "1000", depth: "350", shelves: "4", doors: "0" },
};

export function ElevationPage() {
  const navigate = useNavigate();
  const [productType, setProductType] = useState("cupboard");
  const [width, setWidth] = useState("1800");
  const [height, setHeight] = useState("2100");
  const [depth, setDepth] = useState("550");
  const [thickness, setThickness] = useState("18");
  const [doors, setDoors] = useState("3");
  const [drawers, setDrawers] = useState("0");
  const [shelves, setShelves] = useState("2");
  const [partitions, setPartitions] = useState("2");
  const [backPanel, setBackPanel] = useState(true);
  const [tiltedShelves, setTiltedShelves] = useState(false);
  const [keyboardTray, setKeyboardTray] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ElevResult | null>(null);

  const product = PRODUCTS.find((p) => p.value === productType)!;

  const handleTypeChange = (type: string) => {
    setProductType(type);
    const d = DEFAULTS[type] || {};
    setWidth(d.width || "1000"); setHeight(d.height || "1000"); setDepth(d.depth || "400");
    setDoors(d.doors || "0"); setDrawers(d.drawers || "0"); setShelves(d.shelves || "2"); setPartitions(d.partitions || "0");
    setResult(null);
  };

  const handleGenerate = async () => {
    setGenerating(true); setResult(null);
    try {
      const res = await api.post("/elevation/generate", {
        product_type: productType,
        width: Number(width), height: Number(height), depth: Number(depth),
        material_thickness: Number(thickness), doors: Number(doors), drawers: Number(drawers),
        shelves: Number(shelves), partitions: Number(partitions), back_panel: backPanel,
        tilted_shelves: tiltedShelves, keyboard_tray: keyboardTray,
      });
      setResult(res.data);
      toast.success(`${res.data.summary.total_pieces} pieces generated`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setGenerating(false); }
  };

  const handleSendToCutPlanner = () => {
    if (!result) return;
    const encoded = encodeURIComponent(JSON.stringify(result.pieces));
    navigate(`/cut-planner?pieces=${encoded}`);
  };

  const handlePDF = async () => {
    if (!result) return;
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pw = 210; const m = 10;

      // Title
      pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
      pdf.text(result.summary.product_label, pw / 2, m + 8, { align: "center" });
      pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
      pdf.text(result.summary.dimensions, pw / 2, m + 15, { align: "center" });

      // Pieces table
      let y = m + 25;
      pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
      pdf.text("Pieces List", m, y); y += 6;
      pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
      pdf.text("Label", m, y); pdf.text("Length", m + 60, y); pdf.text("Width", m + 85, y); pdf.text("Qty", m + 110, y);
      y += 4; pdf.setFont("helvetica", "normal");
      for (const p of result.pieces) {
        pdf.text(p.label, m, y); pdf.text(`${p.length}`, m + 60, y); pdf.text(`${p.width}`, m + 85, y); pdf.text(`${p.quantity}`, m + 110, y);
        y += 3.5;
      }
      y += 4;
      pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
      pdf.text(`Total: ${result.summary.total_pieces} pieces`, m, y);

      // Note about views
      y += 10;
      pdf.setFontSize(7); pdf.setTextColor(130);
      pdf.text("Front and side elevation views are displayed on screen. Use browser print for diagrams.", m, y);

      pdf.save(`Elevation-${result.summary.product_label.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF downloaded!");
    } catch { toast.error("PDF failed"); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b bg-gray-800 px-4 py-2 flex-shrink-0">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Ruler className="h-5 w-5" /> Product Elevation
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleGenerate} disabled={generating} className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="mr-1.5 h-4 w-4" /> {generating ? "Generating..." : "Generate"}
          </Button>
          {result && (
            <>
              <Button onClick={handleSendToCutPlanner} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="mr-1.5 h-4 w-4" /> Send to Cut Planner
              </Button>
              <Button variant="outline" className="border-gray-500 text-gray-200 hover:bg-gray-700" onClick={handlePDF}>
                <Download className="mr-1.5 h-4 w-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Inputs */}
        <div className="w-[320px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 space-y-4">
          {/* Product Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500">Product Type</label>
            <select value={productType} onChange={(e) => handleTypeChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium">
              {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Dimensions */}
          <div className="border-t pt-3">
            <label className="text-xs font-semibold text-gray-500">Dimensions (mm)</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div><label className="text-[10px] text-gray-400">Width</label>
                <Input type="number" value={width} onChange={(e) => { setWidth(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
              <div><label className="text-[10px] text-gray-400">Height</label>
                <Input type="number" value={height} onChange={(e) => { setHeight(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
              <div><label className="text-[10px] text-gray-400">Depth</label>
                <Input type="number" value={depth} onChange={(e) => { setDepth(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-gray-400">Material Thickness</label>
              <Input type="number" value={thickness} onChange={(e) => setThickness(e.target.value)} className="h-8 text-sm w-24" />
            </div>
          </div>

          {/* Configuration */}
          <div className="border-t pt-3">
            <label className="text-xs font-semibold text-gray-500">Configuration</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {product.hasDoorsField && (
                <div><label className="text-[10px] text-gray-400">Doors</label>
                  <Input type="number" min="0" value={doors} onChange={(e) => { setDoors(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
              )}
              {product.hasDrawers && (
                <div><label className="text-[10px] text-gray-400">Drawers</label>
                  <Input type="number" min="0" value={drawers} onChange={(e) => { setDrawers(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
              )}
              <div><label className="text-[10px] text-gray-400">Shelves</label>
                <Input type="number" min="0" value={shelves} onChange={(e) => { setShelves(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
              {product.hasPartitions && (
                <div><label className="text-[10px] text-gray-400">Partitions</label>
                  <Input type="number" min="0" value={partitions} onChange={(e) => { setPartitions(e.target.value); setResult(null); }} className="h-8 text-sm" /></div>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="border-t pt-3 space-y-2">
            <label className="text-xs font-semibold text-gray-500">Options</label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={backPanel} onChange={(e) => setBackPanel(e.target.checked)} className="rounded h-3.5 w-3.5" />
              Back Panel
            </label>
            {productType === "shoe_rack" && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={tiltedShelves} onChange={(e) => setTiltedShelves(e.target.checked)} className="rounded h-3.5 w-3.5" />
                Tilted Shelves
              </label>
            )}
            {productType === "study_table" && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={keyboardTray} onChange={(e) => setKeyboardTray(e.target.checked)} className="rounded h-3.5 w-3.5" />
                Keyboard Tray
              </label>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Results */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {!result ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Ruler className="mx-auto h-16 w-16 text-gray-200 mb-4" />
                <p className="text-gray-400 text-sm">Select product type, enter dimensions, click <strong>Generate</strong></p>
                <p className="text-gray-300 text-xs mt-2">Front + Side elevation views with auto-calculated pieces</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="flex items-center gap-5 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="text-center"><p className="text-lg font-bold text-indigo-700">{result.summary.product_label}</p><p className="text-[10px] text-gray-400">Product</p></div>
                <div className="text-center"><p className="text-lg font-bold text-gray-900">{result.summary.dimensions}</p><p className="text-[10px] text-gray-400">Dimensions</p></div>
                <div className="text-center"><p className="text-lg font-bold text-green-700">{result.summary.total_pieces}</p><p className="text-[10px] text-gray-400">Total Pieces</p></div>
                <div className="text-center"><p className="text-lg font-bold text-amber-700">{(result.summary.total_area_mm2 / 1000000).toFixed(2)} m²</p><p className="text-[10px] text-gray-400">Total Area</p></div>
              </div>

              {/* SVG Views */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div dangerouslySetInnerHTML={{ __html: result.front_view_svg }} />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div dangerouslySetInnerHTML={{ __html: result.side_view_svg }} />
                </div>
              </div>

              {/* Pieces Table */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Pieces List — {result.summary.total_pieces} pieces</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-gray-500">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Label</th>
                      <th className="pb-2 pr-3 text-right">Length (mm)</th>
                      <th className="pb-2 pr-3 text-right">Width (mm)</th>
                      <th className="pb-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.pieces.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                        <td className="py-1.5 pr-3 font-medium text-gray-900">{p.label}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-600">{p.length}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-600">{p.width}</td>
                        <td className="py-1.5 text-right font-medium">{p.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button onClick={handleSendToCutPlanner} className="bg-blue-600 hover:bg-blue-700">
                  <Send className="mr-2 h-4 w-4" /> Send {result.summary.total_pieces} pieces to Cut Planner
                </Button>
                <Button variant="outline" onClick={handlePDF}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
