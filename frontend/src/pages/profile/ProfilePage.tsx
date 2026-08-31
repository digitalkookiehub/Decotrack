import { useEffect, useRef, useState } from "react";
import { User, Lock, Shield, Building2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { PageHeader } from "../../components/shared/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { formatINR } from "../../lib/currency";
import api from "../../services/api";

export function ProfilePage() {
  const { user } = useAuth();
  const [editForm, setEditForm] = useState({ full_name: user?.full_name || "", phone: user?.phone || "" });
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [thresholds, setThresholds] = useState({
    po: user?.auto_approve_po_threshold?.toString() || "",
    wo: user?.auto_approve_wo_threshold?.toString() || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Company Profile
  const [company, setCompany] = useState<Record<string, string | null>>({});
  const [savingCompany, setSavingCompany] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/company/profile").then((r) => setCompany(r.data)).catch(() => {});
  }, []);

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      await api.put("/company/profile", company);
      toast.success("Company profile updated");
    } catch { toast.error("Failed"); }
    finally { setSavingCompany(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/company/profile/logo", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setCompany({ ...company, logo_path: res.data.logo_path });
      toast.success("Logo uploaded");
    } catch { toast.error("Upload failed"); }
    if (logoRef.current) logoRef.current.value = "";
  };

  const updateCompany = (field: string, value: string) => setCompany({ ...company, [field]: value });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put("/auth/me", editForm);
      toast.success("Profile updated");
    } catch { toast.error("Failed to update profile"); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm_password) { toast.error("Passwords don't match"); return; }
    if (pwForm.new_password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSavingPw(true);
    try {
      await api.put("/auth/me/password", { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success("Password changed");
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSavingPw(false); }
  };

  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    try {
      await api.put("/admin/settings", {
        auto_approve_po_threshold: thresholds.po ? parseFloat(thresholds.po) : null,
        auto_approve_wo_threshold: thresholds.wo ? parseFloat(thresholds.wo) : null,
      });
      toast.success("Auto-approve thresholds saved");
    } catch { toast.error("Failed to save"); }
    finally { setSavingThresholds(false); }
  };

  return (
    <div>
      <PageHeader title="Profile" subtitle={user?.email || ""} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input className="mt-1 bg-gray-50" value={user?.email || ""} disabled />
            </div>
            <div>
              <Label>Role</Label>
              <div className="mt-1"><Badge variant="secondary">{user?.role}</Badge></div>
            </div>
            <Separator />
            <div>
              <Label>Full Name</Label>
              <Input className="mt-1" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Changes"}</Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input className="mt-1" type="password" value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} />
            </div>
            <div>
              <Label>New Password</Label>
              <Input className="mt-1" type="password" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input className="mt-1" type="password" value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPw}>{savingPw ? "Changing..." : "Change Password"}</Button>
          </CardContent>
        </Card>

        {/* Auto-Approve Thresholds (Admin only) */}
        {user?.role === "ADMIN" && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Auto-Approve Thresholds</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Set maximum amounts that will be auto-approved without manual review. Leave blank to require manual approval for all amounts.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Purchase Order Threshold (₹)</Label>
                  <Input className="mt-1" type="number" placeholder="e.g., 25000" value={thresholds.po}
                    onChange={(e) => setThresholds({ ...thresholds, po: e.target.value })} />
                  {thresholds.po && <p className="text-xs text-gray-500 mt-1">POs up to {formatINR(parseFloat(thresholds.po))} will be auto-approved</p>}
                </div>
                <div>
                  <Label>Work Order Threshold (₹)</Label>
                  <Input className="mt-1" type="number" placeholder="e.g., 50000" value={thresholds.wo}
                    onChange={(e) => setThresholds({ ...thresholds, wo: e.target.value })} />
                  {thresholds.wo && <p className="text-xs text-gray-500 mt-1">WOs up to {formatINR(parseFloat(thresholds.wo))} will be auto-approved</p>}
                </div>
              </div>
              <Button className="mt-4" onClick={handleSaveThresholds} disabled={savingThresholds}>{savingThresholds ? "Saving..." : "Save Thresholds"}</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Company Profile */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">This information appears on quotations, invoices, and PDF exports.</p>

          {/* Logo */}
          <div className="mb-6 flex items-center gap-4">
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            {company.logo_path ? (
              <img src={`${import.meta.env.VITE_API_URL || ""}${company.logo_path}`} alt="Logo" className="h-16 w-auto rounded border" />
            ) : (
              <div className="h-16 w-16 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">No logo</div>
            )}
            <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
              <Upload className="mr-1 h-3 w-3" /> Upload Logo
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>Company Name</Label><Input className="mt-1" value={company.company_name || ""} onChange={(e) => updateCompany("company_name", e.target.value)} /></div>
            <div><Label>Tagline</Label><Input className="mt-1" value={company.tagline || ""} onChange={(e) => updateCompany("tagline", e.target.value)} placeholder="e.g. Modular Kitchen & Interiors" /></div>
            <div><Label>GSTIN</Label><Input className="mt-1" value={company.gstin || ""} onChange={(e) => updateCompany("gstin", e.target.value)} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={company.phone || ""} onChange={(e) => updateCompany("phone", e.target.value)} /></div>
            <div><Label>Mobile</Label><Input className="mt-1" value={company.mobile || ""} onChange={(e) => updateCompany("mobile", e.target.value)} /></div>
            <div><Label>Email</Label><Input className="mt-1" value={company.email || ""} onChange={(e) => updateCompany("email", e.target.value)} /></div>
            <div><Label>Website</Label><Input className="mt-1" value={company.website || ""} onChange={(e) => updateCompany("website", e.target.value)} /></div>
            <div className="sm:col-span-3"><Separator /><h4 className="text-sm font-semibold text-gray-700 mt-2">Registered Office Address</h4></div>
            <div className="sm:col-span-2"><Label>Address Line 1</Label><Input className="mt-1" value={company.address_line1 || ""} onChange={(e) => updateCompany("address_line1", e.target.value)} /></div>
            <div><Label>Address Line 2</Label><Input className="mt-1" value={company.address_line2 || ""} onChange={(e) => updateCompany("address_line2", e.target.value)} /></div>
            <div><Label>City</Label><Input className="mt-1" value={company.city || ""} onChange={(e) => updateCompany("city", e.target.value)} /></div>
            <div><Label>State</Label><Input className="mt-1" value={company.state || ""} onChange={(e) => updateCompany("state", e.target.value)} /></div>
            <div><Label>Pincode</Label><Input className="mt-1" value={company.pincode || ""} onChange={(e) => updateCompany("pincode", e.target.value)} /></div>

            <div className="sm:col-span-3"><Separator /><h4 className="text-sm font-semibold text-gray-700 mt-2">Factory Address</h4></div>
            <div className="sm:col-span-2"><Label>Factory Address Line 1</Label><Input className="mt-1" value={company.factory_address_line1 || ""} onChange={(e) => updateCompany("factory_address_line1", e.target.value)} /></div>
            <div><Label>Factory Address Line 2</Label><Input className="mt-1" value={company.factory_address_line2 || ""} onChange={(e) => updateCompany("factory_address_line2", e.target.value)} /></div>
            <div><Label>City</Label><Input className="mt-1" value={company.factory_city || ""} onChange={(e) => updateCompany("factory_city", e.target.value)} /></div>
            <div><Label>State</Label><Input className="mt-1" value={company.factory_state || ""} onChange={(e) => updateCompany("factory_state", e.target.value)} /></div>
            <div><Label>Pincode</Label><Input className="mt-1" value={company.factory_pincode || ""} onChange={(e) => updateCompany("factory_pincode", e.target.value)} /></div>
          </div>

          <Separator className="my-6" />
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Bank Details (shown on quotations)</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>Bank Name</Label><Input className="mt-1" value={company.bank_name || ""} onChange={(e) => updateCompany("bank_name", e.target.value)} /></div>
            <div><Label>Account Name</Label><Input className="mt-1" value={company.bank_account_name || ""} onChange={(e) => updateCompany("bank_account_name", e.target.value)} /></div>
            <div><Label>Account Number</Label><Input className="mt-1" value={company.bank_account_number || ""} onChange={(e) => updateCompany("bank_account_number", e.target.value)} /></div>
            <div><Label>IFSC Code</Label><Input className="mt-1" value={company.bank_ifsc || ""} onChange={(e) => updateCompany("bank_ifsc", e.target.value)} /></div>
            <div><Label>Branch</Label><Input className="mt-1" value={company.bank_branch || ""} onChange={(e) => updateCompany("bank_branch", e.target.value)} /></div>
          </div>

          <Separator className="my-6" />
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Quotation Defaults</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Owner / Authorized Person Name</Label><Input className="mt-1" value={company.owner_name || ""} onChange={(e) => updateCompany("owner_name", e.target.value)} /></div>
            <div><Label>Owner Phone</Label><Input className="mt-1" value={company.owner_phone || ""} onChange={(e) => updateCompany("owner_phone", e.target.value)} /></div>
            <div><Label>Prepared By (default)</Label><Input className="mt-1" value={company.prepared_by || ""} onChange={(e) => updateCompany("prepared_by", e.target.value)} /></div>
          </div>
          <div className="mt-4">
            <Label>Default Terms & Conditions</Label>
            <textarea className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={5}
              value={company.default_terms || ""} onChange={(e) => updateCompany("default_terms", e.target.value)}
              placeholder="1. 50% advance on order confirmation&#10;2. 30% before delivery&#10;3. 10% after installation&#10;..." />
          </div>
          <div className="mt-4">
            <Label>Material Specifications (shown on quotation page 2)</Label>
            <textarea className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={5}
              value={company.material_specs || ""} onChange={(e) => updateCompany("material_specs", e.target.value)}
              placeholder="Carcass Panel: 18mm BWR Plywood&#10;Shutter Panels: 18mm / 19mm&#10;Laminate: 0.8mm (normal cost)&#10;..." />
          </div>

          <Button className="mt-4" onClick={handleSaveCompany} disabled={savingCompany}>
            {savingCompany ? "Saving..." : "Save Company Profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
