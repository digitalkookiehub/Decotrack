import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Trash2, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";
import toast from "react-hot-toast";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-amber-100 text-amber-700",
};

interface Quote {
  id: number; quote_number: string; client_name: string; project_name: string | null;
  status: string; grand_total: number; created_at: string;
}

export function QuotationListPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get("/quotations/?per_page=50").then((r) => { setQuotes(r.data.items); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this quotation?")) return;
    await api.delete(`/quotations/${id}`);
    setQuotes(quotes.filter((q) => q.id !== id));
    toast.success("Deleted");
  };

  const handlePDF = async (id: number, num: string) => {
    const res = await api.get(`/quotations/${id}/pdf`, { responseType: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(res.data);
    a.download = `Quote-${num}.pdf`; a.click();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="Quotations" subtitle={`${total} quotes`}
        action={<Link to="/quotations/new"><Button><Plus className="mr-2 h-4 w-4" />New Quote</Button></Link>} />

      {quotes.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations yet" description="Create your first quotation for a client"
          action={<Link to="/quotations/new"><Button><Plus className="mr-2 h-4 w-4" />New Quote</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/quotations/${q.id}`} className="font-medium text-indigo-600 hover:underline">{q.quote_number}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{q.client_name}</td>
                  <td className="px-4 py-3 text-gray-600">{q.project_name || "—"}</td>
                  <td className="px-4 py-3 font-semibold">{formatINR(q.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status] || ""}`}>{q.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(q.created_at)}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => handlePDF(q.id, q.quote_number)} className="text-gray-400 hover:text-indigo-600" title="Download PDF">
                      <Download className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(q.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
