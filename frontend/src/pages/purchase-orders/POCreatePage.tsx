import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import { formatINR, formatNumber } from "../../lib/currency";
import api from "../../services/api";

interface Vendor {
  id: number;
  name: string;
}

interface Material {
  id: number;
  name: string;
  sku: string;
  unit: string;
  current_stock: number;
  last_purchase_rate: number;
}

interface LineItem {
  raw_material_id: number;
  material_name: string;
  material_unit: string;
  current_stock: number;
  last_purchase_rate: number;
  quantity: string;
  rate: string;
}

export function POCreatePage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/vendors/?per_page=100")
      .then((res) => setVendors(res.data.items || []))
      .catch((err) => toast.error("Failed to load vendors: " + (err.response?.status || err.message)));
    api
      .get("/raw-materials?per_page=100")
      .then((res) => {
        const items = res.data.items || [];
        setMaterials(items);
      })
      .catch((err) => toast.error("Failed to load materials: " + (err.response?.status || err.message)));
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        raw_material_id: 0,
        material_name: "",
        material_unit: "",
        current_stock: 0,
        last_purchase_rate: 0,
        quantity: "",
        rate: "",
      },
    ]);
  };

  const updateItem = (index: number, materialId: number) => {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      raw_material_id: materialId,
      material_name: material.name,
      material_unit: material.unit,
      current_stock: material.current_stock,
      last_purchase_rate: material.last_purchase_rate,
      rate: String(material.last_purchase_rate),
    };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    return sum + qty * rate;
  }, 0);

  const handleSubmit = async (submitForApproval: boolean) => {
    if (!vendorId) {
      toast.error("Select a vendor");
      return;
    }
    if (items.length === 0 || items.some((i) => !i.raw_material_id)) {
      toast.error("Add at least one item");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vendor_id: parseInt(vendorId),
        notes: notes || null,
        items: items.map((i) => ({
          raw_material_id: i.raw_material_id,
          quantity: parseFloat(i.quantity),
          rate: parseFloat(i.rate),
        })),
      };

      const res = await api.post("/purchase-orders/", payload);
      const poId = res.data.id;

      if (submitForApproval) {
        await api.post(`/purchase-orders/${poId}/submit`);
        toast.success("PO created and submitted for approval");
      } else {
        toast.success("PO saved as draft");
      }

      navigate(`/purchase-orders/${poId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create PO";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="New Purchase Order"
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <div className="grid gap-6">
        {/* Vendor & Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Vendor *</Label>
              <select
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                className="mt-1"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No items added. Click "Add Item" to start.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Item {idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Material</Label>
                      <select
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        value={item.raw_material_id || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) updateItem(idx, parseInt(val));
                        }}
                      >
                        <option value="">-- Select material --</option>
                        {materials.map((m) => (
                          <option key={m.id} value={String(m.id)}>
                            {m.name} ({m.sku}) — Stock: {m.current_stock} {m.unit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Qty"
                          className="mt-1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], quantity: e.target.value };
                            setItems(newItems);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Rate (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Rate"
                          className="mt-1"
                          value={item.rate}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], rate: e.target.value };
                            setItems(newItems);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Amount</Label>
                        <p className="mt-1 py-2 text-sm font-semibold">
                          {formatINR((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0))}
                        </p>
                      </div>
                    </div>
                    {item.raw_material_id > 0 && (
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Current Stock: <strong>{formatNumber(item.current_stock)}</strong> {item.material_unit}</span>
                        <span>Last Rate: <strong>{formatINR(item.last_purchase_rate)}</strong></span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-end pt-3 border-t">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-xl font-bold text-gray-900">{formatINR(totalAmount)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            Save as Draft
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={submitting}>
            Save & Submit for Approval
          </Button>
        </div>
      </div>
    </div>
  );
}
