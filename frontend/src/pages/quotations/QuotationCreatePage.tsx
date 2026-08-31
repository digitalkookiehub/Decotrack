import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PageHeader } from "../../components/shared/PageHeader";
import { formatINR } from "../../lib/currency";
import api from "../../services/api";
import toast from "react-hot-toast";

interface RoomItem {
  description: string;
  height_ft: string;
  width_ft: string;
  depth_ft: string;
  sft: string;  // auto-calculated or manual
  price_per_sft: string;
  amount: string;
}

interface Room {
  name: string;
  items: RoomItem[];
  open: boolean;
}

const E_ITEM: RoomItem = { description: "", height_ft: "", width_ft: "", depth_ft: "", sft: "", price_per_sft: "", amount: "" };

export function QuotationCreatePage() {
  const navigate = useNavigate();

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientArea, setClientArea] = useState("");
  const [followUpBy, setFollowUpBy] = useState("");
  const [projectDesc, setProjectDesc] = useState("");

  const [rooms, setRooms] = useState<Room[]>([
    { name: "MASTER BEDROOM - 1", items: [{ ...E_ITEM }], open: true },
  ]);

  const [discount, setDiscount] = useState("0");
  const [gstPercent, setGstPercent] = useState("18");
  const [transportFee, setTransportFee] = useState("0");
  const [saving, setSaving] = useState(false);

  // Company profile for header
  const [company, setCompany] = useState<Record<string, string | null>>({});
  useEffect(() => { api.get("/company/profile").then((r) => setCompany(r.data)).catch(() => {}); }, []);

  // Room helpers
  const addRoom = () => setRooms([...rooms, { name: `ROOM ${rooms.length + 1}`, items: [{ ...E_ITEM }], open: true }]);
  const removeRoom = (ri: number) => { if (rooms.length > 1) setRooms(rooms.filter((_, i) => i !== ri)); };
  const toggleRoom = (ri: number) => { const u = [...rooms]; u[ri].open = !u[ri].open; setRooms(u); };
  const updateRoomName = (ri: number, name: string) => { const u = [...rooms]; u[ri].name = name; setRooms(u); };

  // Item helpers
  const addItem = (ri: number) => { const u = [...rooms]; u[ri].items.push({ ...E_ITEM }); setRooms(u); };
  const removeItem = (ri: number, ii: number) => {
    const u = [...rooms]; if (u[ri].items.length > 1) u[ri].items.splice(ii, 1); setRooms(u);
  };
  const updateItem = (ri: number, ii: number, field: keyof RoomItem, val: string) => {
    const u = [...rooms];
    u[ri].items[ii] = { ...u[ri].items[ii], [field]: val };
    // Auto-calculate SFT and amount
    const item = u[ri].items[ii];
    const h = Number(item.height_ft) || 0;
    const w = Number(item.width_ft) || 0;
    if (h > 0 && w > 0) {
      const sft = h * w;
      item.sft = sft.toFixed(2);
      item.amount = (sft * (Number(item.price_per_sft) || 0)).toFixed(0);
    }
    setRooms(u);
  };

  // Totals
  const roomTotals = rooms.map((r) => r.items.reduce((s, it) => s + (Number(it.amount) || 0), 0));
  const subtotal = roomTotals.reduce((s, t) => s + t, 0);
  const discountAmt = Number(discount) || 0;
  const afterDiscount = subtotal - discountAmt;
  const gstAmt = afterDiscount * (Number(gstPercent) || 0) / 100;
  const transport = Number(transportFee) || 0;
  const grandTotal = afterDiscount + gstAmt + transport;

  const handleSave = async () => {
    if (!clientName.trim()) { toast.error("Client name required"); return; }
    setSaving(true);
    try {
      // Flatten items for API
      const allItems = rooms.flatMap((r) =>
        r.items.filter((it) => it.description.trim()).map((it) => ({
          description: `[${r.name}] ${it.description}`,
          material_cost: Number(it.amount) || 0,
          labor_cost: 0,
          quantity: 1,
          pieces_json: { room: r.name, height_ft: it.height_ft, width_ft: it.width_ft, depth_ft: it.depth_ft, sft: it.sft, price_per_sft: it.price_per_sft },
        }))
      );
      if (allItems.length === 0) { toast.error("Add items"); setSaving(false); return; }

      const res = await api.post("/quotations/", {
        client_name: clientName,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        client_address: clientAddress || null,
        project_name: projectDesc || clientArea || null,
        items: allItems,
        tax_percent: Number(gstPercent),
        discount_percent: 0,
        terms: company.default_terms || null,
        notes: `Area: ${clientArea}\nFollow up: ${followUpBy}\nTransport: ₹${transport}\nDiscount: ₹${discountAmt}`,
      });
      toast.success(`Quote ${res.data.quote_number} created!`);
      navigate(`/quotations/${res.data.id}`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader title="New Quotation"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>} />

      {/* Company Header Preview */}
      {company.company_name && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center">
          <p className="text-xs text-indigo-600">Quotation will be generated under:</p>
          <p className="font-bold text-indigo-900">{company.company_name}</p>
          {company.gstin && <p className="text-xs text-indigo-700">GSTIN: {company.gstin}</p>}
        </div>
      )}

      {/* Client Details */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Client Details</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <div><Label>Client Name *</Label><Input className="mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input className="mt-1" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></div>
          <div><Label>Area / Location</Label><Input className="mt-1" value={clientArea} onChange={(e) => setClientArea(e.target.value)} /></div>
          <div><Label>Follow Up By</Label><Input className="mt-1" value={followUpBy} onChange={(e) => setFollowUpBy(e.target.value)} /></div>
          <div className="lg:col-span-2"><Label>Project Description</Label><Input className="mt-1" value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} placeholder="e.g. Modular kitchen with wardrobe" /></div>
        </div>
      </div>

      {/* Room-based Items */}
      {rooms.map((room, ri) => (
        <div key={ri} className="rounded-lg border border-gray-200 bg-white">
          {/* Room Header */}
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2">
            <div className="flex items-center gap-2">
              <button onClick={() => toggleRoom(ri)}>
                {room.open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <input value={room.name} onChange={(e) => updateRoomName(ri, e.target.value)}
                className="font-bold text-sm bg-transparent border-0 outline-none text-amber-900 uppercase" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-amber-900">{formatINR(roomTotals[ri])}</span>
              <button onClick={() => removeRoom(ri)} className="text-amber-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>

          {room.open && (
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 font-semibold border-b">
                    <th className="pb-1 text-left w-6">#</th>
                    <th className="pb-1 text-left">Description</th>
                    <th className="pb-1 text-center w-16">Ht (ft)</th>
                    <th className="pb-1 text-center w-16">Wd (ft)</th>
                    <th className="pb-1 text-center w-16">Dp (ft)</th>
                    <th className="pb-1 text-right w-16">Sft</th>
                    <th className="pb-1 text-right w-20">₹/Sft</th>
                    <th className="pb-1 text-right w-24">Amount</th>
                    <th className="pb-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {room.items.map((it, ii) => (
                    <tr key={ii} className="border-b border-gray-50">
                      <td className="py-1 text-gray-400">{ii + 1}</td>
                      <td className="py-1"><input value={it.description} onChange={(e) => updateItem(ri, ii, "description", e.target.value)}
                        placeholder="e.g. 3 door wardrobe" className="w-full text-xs border-0 bg-transparent outline-none focus:bg-blue-50 px-1" /></td>
                      <td className="py-1"><input type="number" step="0.5" value={it.height_ft} onChange={(e) => updateItem(ri, ii, "height_ft", e.target.value)}
                        className="w-full text-xs text-center border-0 bg-transparent outline-none focus:bg-blue-50" /></td>
                      <td className="py-1"><input type="number" step="0.5" value={it.width_ft} onChange={(e) => updateItem(ri, ii, "width_ft", e.target.value)}
                        className="w-full text-xs text-center border-0 bg-transparent outline-none focus:bg-blue-50" /></td>
                      <td className="py-1"><input type="number" step="0.5" value={it.depth_ft} onChange={(e) => updateItem(ri, ii, "depth_ft", e.target.value)}
                        className="w-full text-xs text-center border-0 bg-transparent outline-none focus:bg-blue-50" /></td>
                      <td className="py-1 text-right text-gray-600">{it.sft || "—"}</td>
                      <td className="py-1"><input type="number" value={it.price_per_sft} onChange={(e) => updateItem(ri, ii, "price_per_sft", e.target.value)}
                        className="w-full text-xs text-right border-0 bg-transparent outline-none focus:bg-blue-50" /></td>
                      <td className="py-1 text-right font-medium">{it.amount ? formatINR(Number(it.amount)) : "—"}</td>
                      <td className="py-1"><button onClick={() => removeItem(ri, ii)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => addItem(ri)} className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700">+ Add item</button>
            </div>
          )}
        </div>
      ))}

      <Button variant="outline" onClick={addRoom} className="w-full border-dashed">
        <Plus className="mr-2 h-4 w-4" /> Add Room
      </Button>

      {/* Totals */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex justify-end">
          <div className="w-80 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total Amount</span><span className="font-bold">{formatINR(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Discount (₹)</span>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-7 w-28 text-xs text-right" />
            </div>
            <div className="flex justify-between"><span className="text-gray-500">After Discount</span><span className="font-medium">{formatINR(afterDiscount)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">GST %</span>
              <Input type="number" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} className="h-7 w-20 text-xs text-right" />
            </div>
            <div className="flex justify-between"><span className="text-gray-500">GST Amount</span><span>{formatINR(gstAmt)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Transportation</span>
              <Input type="number" value={transportFee} onChange={(e) => setTransportFee(e.target.value)} className="h-7 w-28 text-xs text-right" />
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-bold text-gray-900">Grand Total</span>
              <span className="font-bold text-xl text-indigo-700">{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Create Quotation"}</Button>
      </div>
    </div>
  );
}
