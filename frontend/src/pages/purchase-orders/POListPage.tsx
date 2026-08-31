import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import api from "../../services/api";

interface PO {
  id: number;
  po_number: string;
  vendor_name: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  approver_name: string | null;
  rejection_reason: string | null;
  items: Array<{ material_name: string; quantity: number }>;
}

export function POListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pos, setPOs] = useState<PO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "20");
    if (status) params.set("status", status);

    api
      .get(`/purchase-orders/?${params}`)
      .then((res) => {
        setPOs(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  const statuses = [
    "",
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "SENT_TO_VENDOR",
    "PARTIALLY_RECEIVED",
    "FULLY_RECEIVED",
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={`${total} orders`}
        action={
          <Link to="/purchase-orders/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New PO
            </Button>
          </Link>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {statuses.map((s) => (
          <button
            key={s}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              status === s
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              if (s) params.set("status", s);
              else params.delete("status");
              params.set("page", "1");
              setSearchParams(params);
            }}
          >
            {s === "" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : pos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No purchase orders"
          description="Create your first purchase order"
          action={
            <Link to="/purchase-orders/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New PO
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">PO Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Items</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pos.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => window.location.href = `/purchase-orders/${po.id}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-indigo-600">{po.po_number}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{po.vendor_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatINR(po.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {po.items?.length ?? 0} item{(po.items?.length ?? 0) !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(po.created_at)}
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
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page - 1)); setSearchParams(p); }}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page + 1)); setSearchParams(p); }}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
