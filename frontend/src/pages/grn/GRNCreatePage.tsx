import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR, formatNumber } from "../../lib/currency";
import api from "../../services/api";

interface PO {
  id: number;
  po_number: string;
  vendor_name: string | null;
  status: string;
  items: Array<{
    id: number;
    raw_material_id: number;
    material_name: string | null;
    material_sku: string | null;
    material_unit: string | null;
    quantity: number;
    rate: number;
    received_qty: number;
  }>;
}

interface GRNLine {
  po_item_id: number;
  raw_material_id: number;
  material_name: string;
  material_sku: string;
  material_unit: string;
  ordered_qty: number;
  already_received: number;
  pending_qty: number;
  received_qty: string;
  accepted_qty: string;
  rejected_qty: string;
  quality_status: string;
  rejection_reason: string;
  rate: string;
}

export function GRNCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pos, setPOs] = useState<PO[]>([]);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [lines, setLines] = useState<GRNLine[]>([]);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const preselectedPO = searchParams.get("po");

  // Load POs that can receive goods
  useEffect(() => {
    api.get("/purchase-orders/?per_page=100&status=APPROVED")
      .then((res) => {
        const approved = res.data.items as PO[];
        // Also get SENT_TO_VENDOR and PARTIALLY_RECEIVED
        return Promise.all([
          Promise.resolve(approved),
          api.get("/purchase-orders/?per_page=100&status=SENT_TO_VENDOR").then((r) => r.data.items as PO[]),
          api.get("/purchase-orders/?per_page=100&status=PARTIALLY_RECEIVED").then((r) => r.data.items as PO[]),
        ]);
      })
      .then(([approved, sent, partial]) => {
        const all = [...approved, ...sent, ...partial];
        setPOs(all);

        // Auto-select if preselected
        if (preselectedPO) {
          const po = all.find((p) => String(p.id) === preselectedPO);
          if (po) selectPO(po);
        }
      })
      .catch(() => toast.error("Failed to load purchase orders"))
      .finally(() => setLoading(false));
  }, []);

  const selectPO = (po: PO) => {
    setSelectedPO(po);
    setLines(
      po.items.map((item) => {
        const pending = item.quantity - (item.received_qty || 0);
        return {
          po_item_id: item.id,
          raw_material_id: item.raw_material_id,
          material_name: item.material_name || "",
          material_sku: item.material_sku || "",
          material_unit: item.material_unit || "",
          ordered_qty: item.quantity,
          already_received: item.received_qty || 0,
          pending_qty: pending,
          received_qty: String(pending > 0 ? pending : 0),
          accepted_qty: String(pending > 0 ? pending : 0),
          rejected_qty: "0",
          quality_status: "ACCEPTED",
          rejection_reason: "",
          rate: String(item.rate),
        };
      })
    );
  };

  const updateLine = (idx: number, field: string, value: string) => {
    const newLines = [...lines];
    const line = { ...newLines[idx], [field]: value };

    // Auto-calculate accepted = received - rejected
    if (field === "received_qty" || field === "rejected_qty") {
      const received = parseFloat(line.received_qty) || 0;
      const rejected = parseFloat(line.rejected_qty) || 0;
      line.accepted_qty = String(Math.max(0, received - rejected));

      if (rejected > 0 && line.quality_status === "ACCEPTED") {
        line.quality_status = rejected >= received ? "REJECTED" : "PARTIAL";
      } else if (rejected === 0) {
        line.quality_status = "ACCEPTED";
      }
    }

    newLines[idx] = line;
    setLines(newLines);
  };

  const totalValue = lines.reduce((sum, l) => sum + (parseFloat(l.accepted_qty) || 0) * (parseFloat(l.rate) || 0), 0);

  const handleSubmit = async () => {
    if (!selectedPO) { toast.error("Select a purchase order"); return; }

    const validLines = lines.filter((l) => (parseFloat(l.received_qty) || 0) > 0);
    if (validLines.length === 0) { toast.error("Enter received quantities"); return; }

    setSubmitting(true);
    try {
      const payload = {
        po_id: selectedPO.id,
        received_date: receivedDate,
        notes: notes || null,
        items: validLines.map((l) => ({
          po_item_id: l.po_item_id,
          raw_material_id: l.raw_material_id,
          received_qty: parseFloat(l.received_qty),
          accepted_qty: parseFloat(l.accepted_qty),
          rejected_qty: parseFloat(l.rejected_qty) || 0,
          quality_status: l.quality_status,
          rejection_reason: l.rejection_reason || null,
          rate: parseFloat(l.rate),
        })),
      };

      const res = await api.post("/grn/", payload);
      toast.success(`GRN ${res.data.grn_number} created — inventory updated`);
      navigate(`/grn/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create GRN";
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="New Goods Received Note"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="grid gap-6">
        {/* PO Selection */}
        <Card>
          <CardHeader><CardTitle className="text-base">Select Purchase Order</CardTitle></CardHeader>
          <CardContent>
            {pos.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No approved purchase orders available for receiving.</p>
                <p className="text-xs text-gray-400 mt-1">Approve a PO first, then come back to create a GRN.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pos.map((po) => (
                  <div
                    key={po.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedPO?.id === po.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => selectPO(po)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-indigo-600">{po.po_number}</span>
                        <span className="text-gray-500 ml-2">{po.vendor_name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{po.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {po.items.length} items — {po.items.filter((i) => i.quantity > (i.received_qty || 0)).length} pending receipt
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* GRN Details */}
        {selectedPO && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Receipt Details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Received Date *</Label>
                  <Input className="mt-1" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea className="mt-1" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader><CardTitle className="text-base">Receive Items</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lines.map((line, idx) => {
                    const hasRejection = (parseFloat(line.rejected_qty) || 0) > 0;
                    return (
                      <div key={idx} className={`rounded-lg border p-4 ${hasRejection ? "border-amber-200 bg-amber-50/50" : "border-gray-200"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">{line.material_name}</p>
                            <p className="text-xs text-gray-400 font-mono">{line.material_sku}</p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <div>Ordered: <strong>{formatNumber(line.ordered_qty)}</strong> {line.material_unit}</div>
                            {line.already_received > 0 && (
                              <div>Already received: <strong>{formatNumber(line.already_received)}</strong></div>
                            )}
                            <div>Pending: <strong className="text-indigo-600">{formatNumber(line.pending_qty)}</strong></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <Label className="text-xs text-gray-500">Received Qty</Label>
                            <Input className="mt-1" type="number" step="0.01" value={line.received_qty}
                              onChange={(e) => updateLine(idx, "received_qty", e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Rejected Qty</Label>
                            <Input className="mt-1" type="number" step="0.01" value={line.rejected_qty}
                              onChange={(e) => updateLine(idx, "rejected_qty", e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Accepted Qty</Label>
                            <Input className="mt-1 bg-gray-50" type="number" value={line.accepted_qty} readOnly />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Rate (₹)</Label>
                            <Input className="mt-1" type="number" step="0.01" value={line.rate}
                              onChange={(e) => updateLine(idx, "rate", e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Quality</Label>
                            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm"
                              value={line.quality_status}
                              onChange={(e) => updateLine(idx, "quality_status", e.target.value)}>
                              <option value="ACCEPTED">Accepted</option>
                              <option value="PARTIAL">Partial</option>
                              <option value="REJECTED">Rejected</option>
                            </select>
                          </div>
                        </div>

                        {hasRejection && (
                          <div className="mt-2">
                            <Label className="text-xs text-gray-500">Rejection Reason</Label>
                            <Input className="mt-1" placeholder="Reason for rejection..."
                              value={line.rejection_reason}
                              onChange={(e) => updateLine(idx, "rejection_reason", e.target.value)} />
                          </div>
                        )}

                        <div className="mt-2 text-right text-sm">
                          <span className="text-gray-500">Line value: </span>
                          <span className="font-semibold">{formatINR((parseFloat(line.accepted_qty) || 0) * (parseFloat(line.rate) || 0))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="flex justify-end mt-4 pt-4 border-t">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Accepted Value</p>
                    <p className="text-xl font-bold">{formatINR(totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                <Check className="h-4 w-4 mr-2" />
                Create GRN & Update Inventory
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
