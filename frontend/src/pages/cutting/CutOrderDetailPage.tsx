import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, RectangleHorizontal, RectangleVertical } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";
import { formatDateTime } from "../../lib/date";
import toast from "react-hot-toast";

// Reuse types and components from CutPlannerPage
const SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PIECE_COLORS = [
  "#dbeafe", "#fce7f3", "#fef3c7", "#d1fae5", "#e0e7ff",
  "#ede9fe", "#fee2e2", "#ccfbf1", "#ffedd5", "#cffafe",
  "#ecfccb", "#f5d0fe", "#fed7aa", "#a5f3fc", "#d9f99d",
];
const PIECE_BORDERS = [
  "#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#6366f1",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
  "#84cc16", "#e879f9", "#fb923c", "#22d3ee", "#a3e635",
];

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  CUTTING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

interface CutOrder {
  id: number;
  cut_order_number: string;
  product_type: string;
  status: string;
  job_type: string;
  company_name: string | null;
  company_contact: string | null;
  company_phone: string | null;
  job_reference: string | null;
  notes: string | null;
  panels: { label: string; width: number; height: number; qty: number }[];
  sheets_required: number;
  wastage_percent: number;
  cost_per_sheet: number;
  total_cost: number;
  material_name: string | null;
  creator_name: string | null;
  created_at: string;
}

interface PlacedPiece {
  label: string; x: number; y: number; width: number; height: number; rotated: boolean; piece_id: number;
}
interface SheetLayout {
  sheet_num: number; placed_pieces: PlacedPiece[]; piece_count: number; waste_percent: number;
}
interface LayoutResult {
  sheets: SheetLayout[];
  summary: { sheet_size_mm: { width: number; height: number }; total_sheets: number; total_pieces: number; waste_percent: number; total_cost: number; cost_per_sheet: number; material_name: string };
}

export function CutOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<CutOrder | null>(null);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orderRes, layoutRes] = await Promise.all([
          api.get(`/cutting/orders/${id}`),
          api.get(`/cutting/orders/${id}/layout`),
        ]);
        setOrder(orderRes.data);
        setLayout(layoutRes.data);
      } catch {
        toast.error("Failed to load cut order");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!resultsRef.current || !layout || !order) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");

      // A4 Portrait: 210mm x 297mm
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      const pageH = 297;
      const margin = 10;

      // Original sheet dimensions
      const origSheetW = layout.summary.sheet_size_mm.width;
      const origSheetH = layout.summary.sheet_size_mm.height;
      // Rotate sheet 90° for portrait — long side runs vertically
      const sheetW = origSheetH;  // becomes width on page
      const sheetH = origSheetW;  // becomes height on page

      const rightX = pageW - margin;
      const today = new Date().toLocaleDateString("en-IN");

      for (let si = 0; si < layout.sheets.length; si++) {
        if (si > 0) pdf.addPage();
        const sheet = layout.sheets[si];

        // ── TOP HEADER ROW (Portrait layout) ──
        // Left side: Material info + Cutting list
        const leftColW = 100;
        let ly = margin;

        // Material name & sheet size
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text(order.material_name || "Material", margin, ly + 4);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Sheet Size : ${sheetW} mm x ${sheetH} mm`, margin, ly + 9);
        ly += 14;

        // Separator line
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.2);
        pdf.line(margin, ly, margin + leftColW, ly);
        ly += 3;

        // Cutting list header
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.text("Cutting List", margin, ly + 3);
        ly += 6;

        pdf.setFontSize(6.5);
        pdf.text("Sym", margin, ly + 3);
        pdf.text("Length", margin + 10, ly + 3);
        pdf.text("Width", margin + 28, ly + 3);
        pdf.text("Qty", margin + 46, ly + 3);
        ly += 4;
        pdf.setDrawColor(200);
        pdf.line(margin, ly, margin + leftColW, ly);
        ly += 1;

        // Cutting list rows
        pdf.setFont("helvetica", "normal");
        const sheetPieceIds = [...new Set(sheet.placed_pieces.map((p) => p.piece_id))];
        for (const pid of sheetPieceIds) {
          const piece = sheet.placed_pieces.find((p) => p.piece_id === pid)!;
          const count = sheet.placed_pieces.filter((p) => p.piece_id === pid).length;
          const sym = SYMBOLS[pid % 26];
          const border = PIECE_BORDERS[pid % PIECE_BORDERS.length];
          const r = parseInt(border.slice(1, 3), 16);
          const g = parseInt(border.slice(3, 5), 16);
          const b = parseInt(border.slice(5, 7), 16);

          pdf.setTextColor(r, g, b);
          pdf.setFont("helvetica", "bold");
          pdf.text(sym, margin + 2, ly + 3);
          pdf.setTextColor(0);
          pdf.setFont("helvetica", "normal");
          pdf.text(`${Math.round(piece.rotated ? piece.height : piece.width)} mm`, margin + 10, ly + 3);
          pdf.text(`${Math.round(piece.rotated ? piece.width : piece.height)} mm`, margin + 28, ly + 3);
          pdf.text(`${count}`, margin + 48, ly + 3);
          ly += 4;
        }

        ly += 6;
        pdf.setDrawColor(200);
        pdf.line(margin, ly, margin + leftColW, ly);
        ly += 4;

        // Job info below cutting list
        pdf.setFontSize(6.5);
        pdf.setTextColor(100);
        if (order.job_type === "CONTRACT") {
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(180, 100, 0);
          pdf.text("CONTRACT", margin, ly + 3);
          ly += 4;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(60);
          if (order.company_name) { pdf.text(`Company: ${order.company_name}`, margin, ly + 3); ly += 4; }
        } else {
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 128, 0);
          pdf.text("OWN PROJECT", margin, ly + 3);
          ly += 4;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(60);
        }
        pdf.text(`Order: ${order.cut_order_number}`, margin, ly + 3); ly += 4;
        if (order.product_type) { pdf.text(`Site: ${order.product_type}`, margin, ly + 3); ly += 4; }
        pdf.text(`Date: ${today}`, margin, ly + 3); ly += 8;

        // Occurrences
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text("x1", margin + 5, ly + 6);
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150);
        pdf.text("Occurrences", margin, ly - 1);

        // ── TOP RIGHT: Title + stats ──
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text("Job Layout", margin + leftColW + 25, margin + 6, { align: "center" });

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Layout ${sheet.sheet_num} of ${layout.sheets.length}`, rightX, margin + 4, { align: "right" });
        pdf.text(`Layout Wastage: ${sheet.waste_percent.toFixed(1)}%`, rightX, margin + 9, { align: "right" });
        pdf.text(`Sheet Panels: ${sheet.piece_count}`, rightX, margin + 14, { align: "right" });
        pdf.text(`Job Wastage: ${layout.summary.waste_percent.toFixed(1)}%`, rightX, margin + 19, { align: "right" });

        // ── BOTTOM AREA: Sheet drawing (full width, rotated for portrait) ──
        // The original sheet is 2400x1200 but we draw it rotated:
        // Original W (2400) becomes vertical (sheetH=2400)
        // Original H (1200) becomes horizontal (sheetW=1200)
        const drawStartX = margin;
        const drawStartY = Math.max(ly + 5, margin + 50);
        const drawAreaW = pageW - margin * 2;
        const drawAreaH = pageH - drawStartY - margin - 10;
        const scale = Math.min(drawAreaW / sheetW, drawAreaH / sheetH);
        const drawW = sheetW * scale;
        const drawH = sheetH * scale;
        const drawX = drawStartX + (drawAreaW - drawW) / 2;
        const drawY = drawStartY;

        // Sheet outline
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.5);
        pdf.setTextColor(0);
        pdf.rect(drawX, drawY, drawW, drawH);

        // Show original sheet dimensions
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        // Top label = original height (1200mm now horizontal short side)
        pdf.text(`${origSheetH} mm`, drawX + drawW / 2, drawY - 3, { align: "center" });
        // Left label (rotated) = original width (2400mm now vertical long side)
        pdf.text(`${origSheetW} mm`, drawX - 4, drawY + drawH / 2, { align: "center", angle: 90 });

        // Place pieces — rotate 90° CW
        // Original: (x, y, w, h) on a sheet (origW x origH)
        // After 90° CW rotation: new_x = (origH - y - h), new_y = x, new_w = h, new_h = w
        for (const piece of sheet.placed_pieces) {
          // Apply 90° CW rotation
          const newX = origSheetH - piece.y - piece.height;
          const newY = piece.x;
          const newW = piece.height;
          const newH = piece.width;

          const px = drawX + newX * scale;
          const py = drawY + newY * scale;
          let pw = newW * scale;
          let ph = newH * scale;
          if (px + pw > drawX + drawW) pw = drawX + drawW - px;
          if (py + ph > drawY + drawH) ph = drawY + drawH - py;
          if (pw <= 0 || ph <= 0) continue;

          const sym = SYMBOLS[piece.piece_id % 26];
          const border = PIECE_BORDERS[piece.piece_id % PIECE_BORDERS.length];
          const r = parseInt(border.slice(1, 3), 16);
          const g = parseInt(border.slice(3, 5), 16);
          const b = parseInt(border.slice(5, 7), 16);
          const lr = Math.round(r + (255 - r) * 0.75);
          const lg = Math.round(g + (255 - g) * 0.75);
          const lb = Math.round(b + (255 - b) * 0.75);

          pdf.setFillColor(lr, lg, lb);
          pdf.setDrawColor(r, g, b);
          pdf.setLineWidth(0.3);
          pdf.rect(px, py, pw, ph, "FD");

          const minDim = Math.min(pw, ph);
          if (minDim > 6) {
            // Symbol letter
            const fs = Math.max(6, Math.min(minDim * 0.35, 16));
            pdf.setFontSize(fs);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(r, g, b);
            pdf.text(sym, px + pw / 2, py + ph / 2 + fs * 0.15, { align: "center" });

            // After 90° rotation: piece.width is now drawn vertically, piece.height horizontally
            if (pw > 14 && ph > 10) {
              const dimFs = Math.max(4, Math.min(minDim * 0.14, 7));
              pdf.setFontSize(dimFs);
              pdf.setTextColor(50, 50, 50);
              // Top label = piece.height (original short side, now horizontal)
              pdf.text(`${Math.round(piece.height)}`, px + pw / 2, py + dimFs * 0.5 + 0.5, { align: "center" });
              // Left label (rotated) = piece.width (original long side, now vertical)
              pdf.text(`${Math.round(piece.width)}`, px + dimFs * 0.5 + 0.5, py + ph / 2, { align: "center", angle: 90 });
            }
          }
        }

        // Footer
        pdf.setTextColor(0);
        const footerY = pageH - margin + 2;
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150);
        pdf.text("Generated by DecoTrack", pageW / 2, footerY, { align: "center" });
        pdf.text(`Page ${sheet.sheet_num} of ${layout.sheets.length}`, rightX, footerY, { align: "right" });
      }

      pdf.save(`${order.cut_order_number}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!order || !layout) return <div className="p-8 text-center text-gray-500">Cut order not found</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.cut_order_number}
        subtitle={`${order.material_name || "Material"} — ${order.sheets_required} sheets`}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-md border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOrientation("landscape")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${orientation === "landscape" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                <RectangleHorizontal className="h-4 w-4" /> Landscape
              </button>
              <button
                onClick={() => setOrientation("portrait")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-200 ${orientation === "portrait" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                <RectangleVertical className="h-4 w-4" /> Portrait
              </button>
            </div>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" /> {downloading ? "Generating..." : "Download PDF"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/cut-orders")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        }
      />

      {/* Order Info Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || ""}`}>
          {order.status}
        </span>
        {order.job_type === "CONTRACT" ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">Contract</Badge>
        ) : (
          <Badge variant="secondary" className="bg-green-100 text-green-800">Own</Badge>
        )}
        {order.company_name && <span className="text-sm font-medium text-gray-900">{order.company_name}</span>}
        {order.product_type && <span className="text-sm text-gray-500">{order.product_type}</span>}
        <span className="text-xs text-gray-400">Created {formatDateTime(order.created_at)} by {order.creator_name}</span>
      </div>

      {/* Printable Layout */}
      <div ref={resultsRef} className="space-y-6">
        {layout.sheets.map((sheet) => (
          <SheetPage
            key={sheet.sheet_num}
            sheet={sheet}
            sheetWmm={layout.summary.sheet_size_mm.width}
            sheetHmm={layout.summary.sheet_size_mm.height}
            orientation={orientation}
            totalSheets={layout.summary.total_sheets}
            totalPieces={layout.summary.total_pieces}
            jobWaste={layout.summary.waste_percent}
            materialName={layout.summary.material_name}
            orderNumber={order.cut_order_number}
            clientName={order.product_type || ""}
            jobType={order.job_type}
            companyName={order.company_name || ""}
          />
        ))}
      </div>
    </div>
  );
}

function SheetPage({
  sheet, sheetWmm, sheetHmm, orientation, totalSheets, totalPieces, jobWaste,
  materialName, orderNumber, clientName, jobType, companyName,
}: {
  sheet: SheetLayout; sheetWmm: number; sheetHmm: number; orientation: "landscape" | "portrait";
  totalSheets: number; totalPieces: number; jobWaste: number;
  materialName: string; orderNumber: string; clientName: string;
  jobType: string; companyName: string;
}) {
  const sheetPieceIds = [...new Set(sheet.placed_pieces.map((p) => p.piece_id))];
  const sheetCuttingList = sheetPieceIds.map((pid) => {
    const piece = sheet.placed_pieces.find((p) => p.piece_id === pid)!;
    const count = sheet.placed_pieces.filter((p) => p.piece_id === pid).length;
    return {
      symbol: SYMBOLS[pid % 26],
      length: Math.round(piece.rotated ? piece.height : piece.width),
      width: Math.round(piece.rotated ? piece.width : piece.height),
      qty: count,
      color: PIECE_COLORS[pid % PIECE_COLORS.length],
      border: PIECE_BORDERS[pid % PIECE_BORDERS.length],
    };
  });

  const pad = 60;
  // Portrait rotates the sheet 90° CW (long side vertical), matching the PDF
  // export's fixed orientation. Landscape draws the sheet as-is.
  const rotate = orientation === "portrait";
  const drawW = rotate ? sheetHmm : sheetWmm;
  const drawH = rotate ? sheetWmm : sheetHmm;
  const viewW = drawW + pad * 2;
  const viewH = drawH + pad * 2;
  const today = new Date().toLocaleDateString("en-IN");
  const wasteColor = sheet.waste_percent > 25 ? "text-red-600" : sheet.waste_percent > 15 ? "text-amber-600" : "text-green-600";

  return (
    <div className="rounded-lg border border-gray-300 bg-white">
      {/* Header */}
      <div className="border-b border-gray-300 p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-bold text-gray-900">{materialName}</p>
            <p className="text-[11px] text-gray-600">Sheet Size : {drawW} mm x {drawH} mm</p>
            <div className="mt-2">
              <p className="text-[10px] font-bold text-gray-700 border-b border-gray-200 pb-0.5 mb-1">Cutting List</p>
              <table className="w-full text-[10px]">
                <thead><tr className="text-gray-500"><th className="text-left pr-1">Sym</th><th className="text-left pr-1">Length</th><th className="text-left pr-1">Width</th><th className="text-left">Qty</th></tr></thead>
                <tbody>
                  {sheetCuttingList.map((p) => (
                    <tr key={p.symbol}>
                      <td className="pr-1 font-bold" style={{ color: p.border }}>{p.symbol}</td>
                      <td className="pr-1">{p.length} mm</td>
                      <td className="pr-1">{p.width} mm</td>
                      <td>{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">Job Layout</p>
            <div className="mt-1">
              {jobType === "CONTRACT" ? (
                <span className="inline-block rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">CONTRACT JOB</span>
              ) : (
                <span className="inline-block rounded-full bg-green-100 border border-green-300 px-2.5 py-0.5 text-[11px] font-bold text-green-800">OWN PROJECT</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-gray-600 text-left mx-auto max-w-[220px] space-y-0.5">
              {companyName && <p><span className="text-gray-400">Company : </span><strong>{companyName}</strong></p>}
              {clientName && <p><span className="text-gray-400">Site : </span>{clientName}</p>}
              <p><span className="text-gray-400">Order : </span><strong>{orderNumber}</strong></p>
              <p><span className="text-gray-400">Date : </span>{today}</p>
            </div>
          </div>
          <div className="text-right text-[11px] text-gray-600 space-y-0.5">
            <p>Layout {sheet.sheet_num} of {totalSheets}</p>
            <p>Sheet Panels : {sheet.piece_count}</p>
            <p>Layout Wastage : <span className={`font-bold ${wasteColor}`}>{sheet.waste_percent.toFixed(2)}%</span></p>
            <p>Job Panels : {totalPieces}</p>
            <p>Job Wastage : <span className="font-bold">{jobWaste.toFixed(2)}%</span></p>
          </div>
        </div>
      </div>

      {/* SVG Drawing */}
      <div className="p-4">
        <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full" style={{ maxHeight: "600px" }} preserveAspectRatio="xMidYMid meet">
          <rect x={pad} y={pad} width={drawW} height={drawH} fill="#ffffff" stroke="#000" strokeWidth={2} />
          <defs>
            <pattern id={`w-${sheet.sheet_num}`} patternUnits="userSpaceOnUse" width="10" height="10">
              <path d="M0,10 L10,0" stroke="#e5e7eb" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={pad} y={pad} width={drawW} height={drawH} fill={`url(#w-${sheet.sheet_num})`} />

          {sheet.placed_pieces.map((piece, i) => {
            // Portrait applies the same 90° CW rotation as the PDF export.
            const px = (rotate ? (sheetHmm - piece.y - piece.height) : piece.x) + pad;
            const py = (rotate ? piece.x : piece.y) + pad;
            const pw = rotate ? piece.height : piece.width;
            const ph = rotate ? piece.width : piece.height;
            const color = PIECE_COLORS[piece.piece_id % PIECE_COLORS.length];
            const border = PIECE_BORDERS[piece.piece_id % PIECE_BORDERS.length];
            const sym = SYMBOLS[piece.piece_id % 26];
            const minDim = Math.min(pw, ph);
            const fs = Math.max(9, Math.min(minDim * 0.15, 16));
            const showText = pw > 60 && ph > 40;

            return (
              <g key={i}>
                <rect x={px} y={py} width={pw} height={ph} fill={color} stroke={border} strokeWidth={1.5} />
                {showText && (
                  <>
                    <text x={px + pw / 2} y={py + fs} textAnchor="middle" fill="#374151" fontSize={fs * 0.75} fontWeight="600">{Math.round(pw)} mm</text>
                    <text x={px + fs * 0.8} y={py + ph / 2} textAnchor="middle" fill="#374151" fontSize={fs * 0.75} fontWeight="600" transform={`rotate(-90, ${px + fs * 0.8}, ${py + ph / 2})`}>{Math.round(ph)} mm</text>
                    <text x={px + pw / 2} y={py + ph / 2 + fs * 0.3} textAnchor="middle" dominantBaseline="middle" fill={border} fontSize={fs * 2} fontWeight="bold">{sym}</text>
                  </>
                )}
                {!showText && pw > 20 && ph > 20 && (
                  <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" dominantBaseline="middle" fill={border} fontSize={Math.max(6, minDim * 0.4)} fontWeight="bold">{sym}</text>
                )}
              </g>
            );
          })}

          {/* Sheet dimensions */}
          <line x1={pad} y1={pad / 2} x2={pad + drawW} y2={pad / 2} stroke="#666" strokeWidth={0.8} />
          <line x1={pad} y1={pad / 2 - 6} x2={pad} y2={pad / 2 + 6} stroke="#666" strokeWidth={0.8} />
          <line x1={pad + drawW} y1={pad / 2 - 6} x2={pad + drawW} y2={pad / 2 + 6} stroke="#666" strokeWidth={0.8} />
          <text x={pad + drawW / 2} y={pad / 2 - 8} textAnchor="middle" fill="#374151" fontSize={14} fontWeight="bold">{drawW} mm</text>
          <line x1={pad / 2} y1={pad} x2={pad / 2} y2={pad + drawH} stroke="#666" strokeWidth={0.8} />
          <line x1={pad / 2 - 6} y1={pad} x2={pad / 2 + 6} y2={pad} stroke="#666" strokeWidth={0.8} />
          <line x1={pad / 2 - 6} y1={pad + drawH} x2={pad / 2 + 6} y2={pad + drawH} stroke="#666" strokeWidth={0.8} />
          <text x={pad / 2} y={pad + drawH / 2} textAnchor="middle" fill="#374151" fontSize={14} fontWeight="bold" transform={`rotate(-90, ${pad / 2}, ${pad + drawH / 2})`}>{drawH} mm</text>
        </svg>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 px-4 py-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] text-gray-400">Occurrences</p>
            <p className="text-2xl font-bold text-gray-900">x1</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Grain Direction</p>
            <svg width="40" height="30" viewBox="0 0 40 30">
              <line x1="20" y1="28" x2="20" y2="4" stroke="#666" strokeWidth="1.5" />
              <polygon points="14,10 20,2 26,10" fill="#666" />
              <line x1="2" y1="15" x2="38" y2="15" stroke="#999" strokeWidth="1" />
              <polygon points="32,11 38,15 32,19" fill="#999" />
            </svg>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-400">Generated by DecoTrack</p>
          <p className="font-medium text-gray-600">Page {sheet.sheet_num} of {totalSheets}</p>
        </div>
      </div>
    </div>
  );
}
