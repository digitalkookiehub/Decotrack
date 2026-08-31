import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Building2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { BulkActions } from "../../components/shared/BulkActions";
import api from "../../services/api";

interface Vendor {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  supply_categories: string[] | null;
  is_active: boolean;
}

export function VendorListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const search = searchParams.get("search") || "";

  const fetchVendors = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("per_page", "50");
    if (search) params.set("search", search);
    api.get(`/vendors/?${params}`)
      .then((res) => { setVendors(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVendors(); }, [search]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === vendors.length) setSelectedIds([]);
    else setSelectedIds(vendors.map((v) => v.id));
  };

  return (
    <div>
      <PageHeader title="Vendors" subtitle={`${total} vendors`}
        action={<Link to="/vendors/new"><Button><Plus className="h-4 w-4 mr-2" />Add Vendor</Button></Link>} />

      {/* Bulk Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search vendors..." className="pl-9" defaultValue={search}
            onChange={(e) => { const p = new URLSearchParams(searchParams); if (e.target.value) p.set("search", e.target.value); else p.delete("search"); setSearchParams(p); }} />
        </div>
        <BulkActions
          entityType="vendors"
          selectedIds={selectedIds}
          onImportComplete={() => { fetchVendors(); setSelectedIds([]); }}
          onDeleteComplete={() => { fetchVendors(); setSelectedIds([]); }}
        />
      </div>

      {/* Select All */}
      {vendors.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" className="rounded border-gray-300" checked={selectedIds.length === vendors.length && vendors.length > 0}
            onChange={toggleAll} />
          <span className="text-xs text-gray-500">
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all"}
          </span>
        </div>
      )}

      {loading ? <LoadingSpinner /> : vendors.length === 0 ? (
        <EmptyState icon={Building2} title="No vendors found" description="Add vendors manually or import from Excel"
          action={<Link to="/vendors/new"><Button><Plus className="h-4 w-4 mr-2" />Add Vendor</Button></Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((v) => (
            <div key={v.id} className={`rounded-lg border p-4 hover:shadow-md transition-shadow ${selectedIds.includes(v.id) ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 rounded border-gray-300"
                  checked={selectedIds.includes(v.id)}
                  onChange={() => toggleSelect(v.id)} />
                <Link to={`/vendors/${v.id}`} className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{v.name}</p>
                      {v.contact_person && <p className="text-sm text-gray-500">{v.contact_person}</p>}
                    </div>
                    <Building2 className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.city && <span className="text-xs text-gray-500">{v.city}</span>}
                    {v.phone && <span className="text-xs text-gray-400 ml-2">{v.phone}</span>}
                  </div>
                  {v.supply_categories && v.supply_categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {v.supply_categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
