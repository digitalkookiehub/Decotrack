import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import api from "../../services/api";

interface Client { id: number; name: string; }
interface Product { id: number; name: string; sku: string; }

interface RoomItem {
  product_id: number;
  product_name: string;
  quantity: string;
  notes: string;
}

interface RoomGroup {
  room: string;
  customRoom: string;
  items: RoomItem[];
}

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [city, setCity] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/clients/?per_page=100").then((res) => setClients(res.data.items || [])).catch(() => {});
    api.get("/finished-products?per_page=100").then((res) => setProducts(res.data.items || [])).catch(() => {});
  }, []);

  const emptyItem = (): RoomItem => ({ product_id: 0, product_name: "", quantity: "1", notes: "" });

  const addRoom = () => {
    setRoomGroups([...roomGroups, { room: "", customRoom: "", items: [emptyItem()] }]);
  };

  const removeRoom = (roomIdx: number) => setRoomGroups(roomGroups.filter((_, i) => i !== roomIdx));

  const updateRoomName = (roomIdx: number, value: string) => {
    const n = [...roomGroups]; n[roomIdx] = { ...n[roomIdx], room: value }; setRoomGroups(n);
  };

  const updateCustomRoomName = (roomIdx: number, value: string) => {
    const n = [...roomGroups]; n[roomIdx] = { ...n[roomIdx], customRoom: value }; setRoomGroups(n);
  };

  const addItemToRoom = (roomIdx: number) => {
    const n = [...roomGroups];
    n[roomIdx] = { ...n[roomIdx], items: [...n[roomIdx].items, emptyItem()] };
    setRoomGroups(n);
  };

  const removeItemFromRoom = (roomIdx: number, itemIdx: number) => {
    const n = [...roomGroups];
    n[roomIdx] = { ...n[roomIdx], items: n[roomIdx].items.filter((_, i) => i !== itemIdx) };
    setRoomGroups(n);
  };

  const updateItemProduct = (roomIdx: number, itemIdx: number, productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const n = [...roomGroups];
    const items = [...n[roomIdx].items];
    items[itemIdx] = { ...items[itemIdx], product_id: productId, product_name: product.name };
    n[roomIdx] = { ...n[roomIdx], items };
    setRoomGroups(n);
  };

  const updateItemField = (roomIdx: number, itemIdx: number, field: "quantity" | "notes", value: string) => {
    const n = [...roomGroups];
    const items = [...n[roomIdx].items];
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    n[roomIdx] = { ...n[roomIdx], items };
    setRoomGroups(n);
  };

  const handleSubmit = async () => {
    if (!clientId) { toast.error("Select a client"); return; }

    let projectName = name.trim();
    if (!projectName) {
      const client = clients.find((c) => c.id === parseInt(clientId));
      projectName = client ? client.name : "Untitled Project";
      setName(projectName);
    }

    setSubmitting(true);
    try {
      const payload = {
        name: projectName,
        client_id: parseInt(clientId),
        site_address: siteAddress || null,
        city: city || null,
        estimated_cost: parseFloat(estimatedCost) || 0,
        start_date: startDate || null,
        target_completion_date: targetDate || null,
        notes: notes || null,
        items: roomGroups.flatMap((rg) => {
          const roomName = (rg.room === "__custom" ? rg.customRoom : rg.room).trim();
          if (!roomName) return [];
          return rg.items
            .filter((i) => i.product_id > 0)
            .map((i) => ({
              room: roomName,
              product_id: i.product_id,
              quantity: parseInt(i.quantity) || 1,
              notes: i.notes || null,
            }));
        }),
      };

      const res = await api.post("/projects/", payload);
      toast.success(`Project ${res.data.project_number} created`);
      navigate(`/projects/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create project";
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const commonRooms = ["Kitchen", "Master Bedroom", "Living Room", "Kids Room", "Bathroom 1", "Bathroom 2", "Dining Room", "Study Room", "Guest Bedroom", "Pooja Room"];

  return (
    <div>
      <PageHeader title="New Project"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="grid gap-6">
        {/* Project Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Project Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Client *</Label>
              <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Project Name</Label>
              <Input className="mt-1" placeholder="Auto-filled from client name if left blank" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Site Address</Label>
              <Textarea className="mt-1" placeholder="Delivery/site address" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
            </div>
            <div>
              <Label>City</Label>
              <Input className="mt-1" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label>Estimated Cost (₹)</Label>
              <Input className="mt-1" type="number" placeholder="0" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input className="mt-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><Label>Target Date</Label><Input className="mt-1" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea className="mt-1" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Room-wise Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Room-wise Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addRoom}><Plus className="h-4 w-4 mr-1" />Add Room</Button>
          </CardHeader>
          <CardContent>
            {roomGroups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Add a room, then add items to it. Click "Add Room" to start.
              </p>
            ) : (
              <div className="space-y-4">
                {roomGroups.map((rg, roomIdx) => (
                  <div key={roomIdx} className="rounded-lg border border-gray-200 p-4">
                    {/* Room header — picked once per room */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Room *</Label>
                        <select className="mt-1 w-full sm:w-64 rounded-md border border-gray-200 bg-white px-2 py-2 text-sm font-medium"
                          value={rg.room} onChange={(e) => updateRoomName(roomIdx, e.target.value)}>
                          <option value="">Select room</option>
                          {commonRooms.map((r) => <option key={r} value={r}>{r}</option>)}
                          <option value="__custom">Other...</option>
                        </select>
                        {rg.room === "__custom" && (
                          <Input className="mt-1 w-full sm:w-64" placeholder="Custom room name"
                            value={rg.customRoom} onChange={(e) => updateCustomRoomName(roomIdx, e.target.value)} />
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeRoom(roomIdx)} title="Remove room">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>

                    {/* Items within this room */}
                    <div className="space-y-2 ml-0 sm:ml-2">
                      {rg.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_2fr_auto] gap-2 items-end rounded-md bg-gray-50 p-2">
                          <div>
                            <Label className="text-xs text-gray-500">Product *</Label>
                            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm"
                              value={item.product_id || ""} onChange={(e) => { const v = e.target.value; if (v) updateItemProduct(roomIdx, itemIdx, parseInt(v)); }}>
                              <option value="">Select product</option>
                              {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Quantity</Label>
                            <Input className="mt-1" type="number" min="1" value={item.quantity}
                              onChange={(e) => updateItemField(roomIdx, itemIdx, "quantity", e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Notes</Label>
                            <Input className="mt-1" placeholder="Optional" value={item.notes}
                              onChange={(e) => updateItemField(roomIdx, itemIdx, "notes", e.target.value)} />
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeItemFromRoom(roomIdx, itemIdx)} title="Remove item">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addItemToRoom(roomIdx)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Add Item to {(rg.room === "__custom" ? rg.customRoom : rg.room) || "this room"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create Project"}</Button>
        </div>
      </div>
    </div>
  );
}
