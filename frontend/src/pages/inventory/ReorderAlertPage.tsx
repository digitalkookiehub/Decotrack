import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { formatINR, formatNumber } from "../../lib/currency";
import api from "../../services/api";

interface ReorderAlert {
  id: number;
  name: string;
  sku: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  deficit: number;
  last_purchase_rate: number;
}

export function ReorderAlertPage() {
  const [alerts, setAlerts] = useState<ReorderAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/inventory/reorder-alerts")
      .then((res) => setAlerts(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Reorder Alerts"
        subtitle={`${alerts.length} items below reorder level`}
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No reorder alerts"
          description="All materials are above their reorder levels. Great job!"
        />
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{alert.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{alert.sku}</p>
                      </div>
                    </div>
                    <div className="mt-2 ml-8 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Stock: </span>
                        <span className="font-semibold text-red-600">
                          {formatNumber(alert.current_stock)} {alert.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Reorder at: </span>
                        <span>{formatNumber(alert.reorder_level)} {alert.unit}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Deficit: </span>
                        <span className="font-semibold text-red-600">
                          {formatNumber(alert.deficit)} {alert.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Rate: </span>
                        <span>{formatINR(alert.last_purchase_rate)}/{alert.unit}</span>
                      </div>
                    </div>
                  </div>
                  <Link to={`/purchase-orders/new?material=${alert.id}`}>
                    <Button size="sm" variant="outline" className="flex-shrink-0">
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Create PO
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
