import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import api from "../../services/api";

export function VendorCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", contact_person: "", phone: "", email: "",
    address: "", city: "", state: "", gstin: "",
    supply_categories: "", payment_terms: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Vendor name is required"); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        supply_categories: form.supply_categories ? form.supply_categories.split(",").map((s) => s.trim()).filter(Boolean) : null,
        email: form.email || null,
      };
      const res = await api.post("/vendors/", payload);
      toast.success("Vendor created");
      navigate(`/vendors/${res.data.id}`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSubmitting(false); }
  };

  const set = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div>
      <PageHeader title="New Vendor"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <Card>
        <CardHeader><CardTitle className="text-base">Vendor Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label>Name *</Label><Input className="mt-1" placeholder="Vendor name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Contact Person</Label><Input className="mt-1" placeholder="Contact person" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
          <div><Label>Phone</Label><Input className="mt-1" placeholder="9876543210" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>Email</Label><Input className="mt-1" type="email" placeholder="vendor@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>City</Label><Input className="mt-1" placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div><Label>State</Label><Input className="mt-1" placeholder="State" value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Textarea className="mt-1" placeholder="Full address" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>GSTIN</Label><Input className="mt-1" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} /></div>
          <div>
            <Label>Payment Terms</Label>
            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={form.payment_terms} onChange={(e) => set("payment_terms", e.target.value)}>
              <option value="">Select payment terms</option>
              <option value="Cash on Delivery">Cash on Delivery</option>
              <option value="Immediate">Immediate</option>
              <option value="Net 7">Net 7 (7 days)</option>
              <option value="Net 15">Net 15 (15 days)</option>
              <option value="Net 30">Net 30 (30 days)</option>
              <option value="Net 45">Net 45 (45 days)</option>
              <option value="Net 60">Net 60 (60 days)</option>
              <option value="50% Advance">50% Advance, rest on delivery</option>
              <option value="100% Advance">100% Advance</option>
              <option value="Credit 30 days">Credit 30 days</option>
              <option value="Credit 45 days">Credit 45 days</option>
            </select>
          </div>
          <div className="sm:col-span-2"><Label>Supply Categories (comma separated)</Label><Input className="mt-1" placeholder="Sheet Materials, Hardware, Fasteners" value={form.supply_categories} onChange={(e) => set("supply_categories", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea className="mt-1" placeholder="Optional notes..." value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create Vendor"}</Button>
      </div>
    </div>
  );
}
