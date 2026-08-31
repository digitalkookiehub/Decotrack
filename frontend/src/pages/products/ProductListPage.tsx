import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Box } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import api from "../../services/api";

interface Product {
  id: number;
  name: string;
  sku: string;
  category_id: number | null;
  category_name: string | null;
  unit: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  production_stages: string[] | null;
}

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const categoryId = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    api.get("/product-categories").then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("per_page", "50");
    if (categoryId) params.set("category_id", categoryId);
    if (search) params.set("search", search);
    api.get(`/finished-products?${params}`)
      .then((res) => { setProducts(res.data.items); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  }, [categoryId, search]);

  return (
    <div>
      <PageHeader title="Finished Products" subtitle={`${total} products`}
        action={<Link to="/products/new"><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></Link>} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search products..." className="pl-9" defaultValue={search}
            onChange={(e) => { const p = new URLSearchParams(searchParams); if (e.target.value) p.set("search", e.target.value); else p.delete("search"); setSearchParams(p); }} />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${!categoryId ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => { const p = new URLSearchParams(searchParams); p.delete("category"); setSearchParams(p); }}>All</button>
          {categories.map((cat) => (
            <button key={cat.id}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${categoryId === String(cat.id) ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set("category", String(cat.id)); setSearchParams(p); }}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : products.length === 0 ? (
        <EmptyState icon={Box} title="No products" description="Add your first finished product"
          action={<Link to="/products/new"><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`}>
              <div className="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{p.unit}</Badge>
                </div>
                {p.category_name && (
                  <Badge variant="outline" className="mt-2 text-[10px]">{p.category_name}</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
