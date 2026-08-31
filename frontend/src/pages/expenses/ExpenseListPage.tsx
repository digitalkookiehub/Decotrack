import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Receipt, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../../components/ui/dialog";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

const CATEGORIES = [
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "RENT", label: "Rent" },
  { value: "LABOUR_WAGES", label: "Labour Wages" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "FUEL", label: "Fuel" },
  { value: "MACHINE_MAINTENANCE", label: "Machine Maintenance" },
  { value: "TOOLS", label: "Tools" },
  { value: "CONSUMABLES", label: "Consumables" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "FOOD_REFRESHMENTS", label: "Food & Refreshments" },
  { value: "TELEPHONE_INTERNET", label: "Telephone & Internet" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "TAXES_FEES", label: "Taxes & Fees" },
  { value: "SITE_INSTALLATION", label: "Site Installation" },
  { value: "MISCELLANEOUS", label: "Miscellaneous" },
];

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CREDIT_CARD", label: "Credit Card" },
];

interface Expense {
  id: number;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  reference_number: string | null;
  vendor_name: string | null;
  project_id: number | null;
  project_name: string | null;
  notes: string | null;
  is_recurring: boolean;
  creator_name: string | null;
  created_at: string;
}

interface Project { id: number; project_number: string; name: string; }

export function ExpenseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "", description: "", amount: "", payment_mode: "CASH",
    reference_number: "", vendor_name: "", project_id: "", notes: "", is_recurring: false,
  });

  const page = parseInt(searchParams.get("page") || "1");
  const category = searchParams.get("category") || "";

  const fetchExpenses = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "20");
    if (category) params.set("category", category);
    api.get(`/expenses/?${params}`)
      .then((res) => {
        setExpenses(res.data.items);
        setTotal(res.data.total);
        setTotalAmount(res.data.total_amount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchExpenses(); }, [page, category]);
  useEffect(() => {
    api.get("/projects/?per_page=100").then((res) => setProjects(res.data.items || [])).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.category) { toast.error("Select a category"); return; }
    if (!form.description.trim()) { toast.error("Enter description"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Enter valid amount"); return; }

    setSaving(true);
    try {
      await api.post("/expenses/", {
        ...form,
        amount: parseFloat(form.amount),
        project_id: form.project_id ? parseInt(form.project_id) : null,
        reference_number: form.reference_number || null,
        vendor_name: form.vendor_name || null,
        notes: form.notes || null,
      });
      toast.success("Expense recorded");
      setShowAdd(false);
      setForm({
        expense_date: new Date().toISOString().split("T")[0],
        category: "", description: "", amount: "", payment_mode: "CASH",
        reference_number: "", vendor_name: "", project_id: "", notes: "", is_recurring: false,
      });
      fetchExpenses();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success("Expense deleted");
      fetchExpenses();
    } catch { toast.error("Failed"); }
  };

  const getCategoryLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label || val;
  const getCategoryColor = (val: string) => {
    const colors: Record<string, string> = {
      ELECTRICITY: "bg-yellow-100 text-yellow-700", RENT: "bg-blue-100 text-blue-700",
      LABOUR_WAGES: "bg-purple-100 text-purple-700", TRANSPORT: "bg-green-100 text-green-700",
      FUEL: "bg-orange-100 text-orange-700", MACHINE_MAINTENANCE: "bg-red-100 text-red-700",
      TOOLS: "bg-gray-100 text-gray-700", SITE_INSTALLATION: "bg-indigo-100 text-indigo-700",
    };
    return colors[val] || "bg-gray-100 text-gray-700";
  };

  return (
    <div>
      <PageHeader title="Expenses" subtitle={`${total} entries — Total: ${formatINR(totalAmount)}`}
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Total Expenses</p>
            <p className="text-lg font-bold text-red-600">{formatINR(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Entries</p>
            <p className="text-lg font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">This Month</p>
            <p className="text-lg font-bold">{formatINR(expenses.filter((e) => e.expense_date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, e) => s + e.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Project-linked</p>
            <p className="text-lg font-bold">{expenses.filter((e) => e.project_id).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${!category ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          onClick={() => { const p = new URLSearchParams(searchParams); p.delete("category"); p.set("page", "1"); setSearchParams(p); }}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${category === c.value ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => { const p = new URLSearchParams(searchParams); p.set("category", c.value); p.set("page", "1"); setSearchParams(p); }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Expense List */}
      {loading ? <LoadingSpinner /> : expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="No expenses" description="Start tracking your factory expenses"
          action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Payment</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Project</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${getCategoryColor(e.category)}`}>{getCategoryLabel(e.category)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{e.description}</p>
                    {e.vendor_name && <p className="text-xs text-gray-400">Paid to: {e.vendor_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatINR(e.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">{e.payment_mode.replace(/_/g, " ")}</Badge>
                    {e.reference_number && <p className="text-[10px] text-gray-400 mt-0.5">Ref: {e.reference_number}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.project_name || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(e.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page - 1)); setSearchParams(p); }}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page + 1)); setSearchParams(p); }}>Next</Button>
          </div>
        </div>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle><DialogDescription>Record a new factory expense</DialogDescription></DialogHeader>
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <Input className="mt-1" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <Label>Category *</Label>
                <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Input className="mt-1" placeholder="e.g., Electricity bill for March 2026" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₹) *</Label>
                <Input className="mt-1" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                  {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Paid To (Vendor)</Label>
                <Input className="mt-1" placeholder="e.g., TNEB, Petrol Bunk" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
              </div>
              <div>
                <Label>Bill/Reference No.</Label>
                <Input className="mt-1" placeholder="Receipt number" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Link to Project (optional)</Label>
              <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">No project (general factory expense)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1" placeholder="Optional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300" checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
              <Label>Recurring expense (monthly)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Saving..." : "Add Expense"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
