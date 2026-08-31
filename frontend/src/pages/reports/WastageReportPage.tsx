import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatNumber } from "../../lib/currency";
import api from "../../services/api";

interface WastageItem {
  material: string;
  total_wastage: number;
  incidents: number;
}

export function WastageReportPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<WastageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/wastage").then((res) => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Wastage Report" subtitle="Material wastage during production"
        action={<Button variant="outline" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      {data.length === 0 ? (
        <EmptyState icon={Trash2} title="No wastage recorded" description="Wastage is logged during production stage tracking" />
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="p-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Total Incidents</p>
                <p className="text-2xl font-bold text-red-600">{data.reduce((s, d) => s + d.incidents, 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Materials Affected</p>
                <p className="text-2xl font-bold">{data.length}</p>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Material</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total Wastage</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Incidents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((d) => (
                  <tr key={d.material}>
                    <td className="px-4 py-3 font-medium">{d.material}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{formatNumber(d.total_wastage)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{d.incidents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
