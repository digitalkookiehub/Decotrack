import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Factory } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import api from "../../services/api";

interface ActiveWO {
  id: number;
  wo_number: string;
  project_name: string | null;
  status: string;
  total_units: number;
  completed_units: number;
  progress: number;
  items: Array<{
    product_name: string;
    quantity: number;
    completed_count: number;
    status: string;
  }>;
}

export function ProductionOverviewPage() {
  const [wos, setWOs] = useState<ActiveWO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/production/")
      .then((res) => setWOs(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Active Production" subtitle={`${wos.length} work orders in production`} />

      {wos.length === 0 ? (
        <EmptyState icon={Factory} title="No active production"
          description="Approve a work order to start production"
          action={<Link to="/work-orders"><Button>View Work Orders</Button></Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {wos.map((wo) => (
            <Link key={wo.id} to={`/work-orders/${wo.id}/production`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-indigo-600">{wo.wo_number}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{wo.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{wo.project_name}</p>
                </CardHeader>
                <CardContent>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${wo.progress}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-indigo-600">{wo.progress}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {wo.completed_units} / {wo.total_units} units completed
                  </p>
                  <div className="space-y-1">
                    {wo.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{item.product_name}</span>
                        <span className={item.completed_count >= item.quantity ? "text-green-600 font-medium" : "text-gray-500"}>
                          {item.completed_count}/{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
