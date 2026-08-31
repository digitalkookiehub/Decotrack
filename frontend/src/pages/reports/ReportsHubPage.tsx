import { Link } from "react-router-dom";
import { Package, ShoppingCart, AlertTriangle, Factory, Trash2, Truck, FileText, BarChart3 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { PageHeader } from "../../components/shared/PageHeader";

const reports = [
  { title: "Stock Summary", description: "Current stock levels, values, and reorder status", icon: Package, path: "/reports/stock", color: "bg-blue-100 text-blue-600" },
  { title: "Purchase Analytics", description: "Spend per vendor, purchase trends", icon: ShoppingCart, path: "/reports/purchases", color: "bg-green-100 text-green-600" },
  { title: "Wastage Report", description: "Material wastage by item and stage", icon: Trash2, path: "/reports/wastage", color: "bg-red-100 text-red-600" },
  { title: "Audit Trail", description: "Complete inventory movement history", icon: FileText, path: "/reports/audit", color: "bg-purple-100 text-purple-600" },
  { title: "Dispatch Log", description: "Dispatch history with delivery status", icon: Truck, path: "/reports/dispatches", color: "bg-amber-100 text-amber-600" },
];

export function ReportsHubPage() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="Analytics and audit trails" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link key={r.path} to={r.path}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${r.color}`}>
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-gray-900">{r.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{r.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
