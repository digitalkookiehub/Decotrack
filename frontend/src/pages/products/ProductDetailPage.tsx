import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Box } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";

interface BOMItem {
  id: number;
  material_name: string | null;
  material_sku: string | null;
  material_unit: string | null;
  quantity_per_unit: number;
  notes: string | null;
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/finished-products/${id}`).then((res) => { setProduct(res.data); setLoading(false); });
  }, [id]);

  if (loading || !product) return <LoadingSpinner />;

  const bom = (product.bom as BOMItem[]) || [];
  const stages = (product.production_stages as string[]) || [];

  return (
    <div>
      <PageHeader title={product.name as string} subtitle={`SKU: ${product.sku as string}`}
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* BOM Table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Bill of Materials ({bom.length} items)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {bom.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 text-center">No BOM defined for this product.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Material</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Qty per Unit</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bom.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2 font-medium">{b.material_name}</td>
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs">{b.material_sku}</td>
                        <td className="px-4 py-2 text-right">{b.quantity_per_unit}</td>
                        <td className="px-4 py-2 text-gray-500">{b.material_unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-gray-500">Category:</span> <span className="font-medium">{product.category_name as string ?? "—"}</span></div>
              <div><span className="text-gray-500">Unit:</span> <Badge variant="secondary">{product.unit as string}</Badge></div>
              {product.description && <div><span className="text-gray-500">Description:</span> <p className="mt-1 text-gray-700">{product.description as string}</p></div>}
            </CardContent>
          </Card>

          {stages.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Production Stages</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">{idx + 1}</span>
                      <span className="text-sm">{stage}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
