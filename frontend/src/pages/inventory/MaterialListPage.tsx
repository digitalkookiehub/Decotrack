import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Package } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { BulkActions } from "../../components/shared/BulkActions";
import { formatINR } from "../../lib/currency";
import { formatNumber } from "../../lib/currency";
import api from "../../services/api";

interface Material {
  id: number;
  name: string;
  sku: string;
  category_id: number | null;
  unit: string;
  current_stock: number;
  reorder_level: number;
  last_purchase_rate: number;
  is_active: boolean;
}

interface Category {
  id: number;
  name: string;
}

export function MaterialListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("category") || "";

  const fetchMaterials = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "20");
    if (search) params.set("search", search);
    if (categoryId) params.set("category_id", categoryId);

    api
      .get(`/raw-materials?${params}`)
      .then((res) => {
        setMaterials(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMaterials(); }, [page, search, categoryId]);

  useEffect(() => {
    api.get("/categories/").then((res) => setCategories(res.data));
  }, []);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("search", value);
    else params.delete("search");
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleCategoryFilter = (catId: string) => {
    const params = new URLSearchParams(searchParams);
    if (catId) params.set("category", catId);
    else params.delete("category");
    params.set("page", "1");
    setSearchParams(params);
  };

  return (
    <div>
      <PageHeader
        title="Raw Materials"
        subtitle={`${total} materials`}
        action={
          <Link to="/inventory/materials/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          </Link>
        }
      />

      {/* Bulk Actions */}
      <div className="mb-4">
        <BulkActions
          entityType="materials"
          selectedIds={selectedIds}
          onImportComplete={() => { fetchMaterials(); setSelectedIds([]); }}
          onDeleteComplete={() => { fetchMaterials(); setSelectedIds([]); }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or SKU..."
            className="pl-9"
            defaultValue={search}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length === 0 || val.length >= 2) handleSearch(val);
            }}
          />
        </div>
        <select
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          value={categoryId}
          onChange={(e) => handleCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No materials found"
          description={search ? "Try a different search term" : "Add your first raw material"}
          action={
            <Link to="/inventory/materials/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={selectedIds.length === materials.length && materials.length > 0}
                      onChange={() => { if (selectedIds.length === materials.length) setSelectedIds([]); else setSelectedIds(materials.map((m) => m.id)); }} />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Material</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Stock</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Reorder Level</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Last Rate</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {materials.map((m) => {
                  const belowReorder = m.current_stock <= m.reorder_level;
                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedIds.includes(m.id) ? "bg-indigo-50" : ""}`}
                      onClick={() => window.location.href = `/inventory/materials/${m.id}`}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-gray-300"
                          checked={selectedIds.includes(m.id)}
                          onChange={() => setSelectedIds((prev) => prev.includes(m.id) ? prev.filter((i) => i !== m.id) : [...prev, m.id])} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{m.name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.sku}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={belowReorder ? "text-red-600 font-semibold" : "text-gray-900"}>
                          {formatNumber(m.current_stock)}
                        </span>
                        <span className="text-gray-400 ml-1 text-xs">{m.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {formatNumber(m.reorder_level)} {m.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatINR(m.last_purchase_rate)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatINR(m.current_stock * m.last_purchase_rate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {belowReorder ? (
                          <Badge variant="destructive" className="text-[10px]">Low Stock</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">In Stock</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("page", String(page - 1));
                    setSearchParams(params);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= total}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("page", String(page + 1));
                    setSearchParams(params);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
