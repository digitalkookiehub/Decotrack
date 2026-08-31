import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, FolderKanban, Factory, Truck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { formatINR } from "../../lib/currency";
import api from "../../services/api";

interface ProjectDetail {
  id: number;
  project_number: string;
  name: string;
  client: { id: number; name: string } | null;
  site_address: string | null;
  city: string | null;
  status: string;
  estimated_cost: number;
  actual_cost: number;
  start_date: string | null;
  target_completion_date: string | null;
  notes: string | null;
  rooms: Record<string, Array<{
    id: number;
    product_id: number;
    product_name: string | null;
    quantity: number;
    status: string;
    notes: string | null;
  }>>;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${id}`).then((res) => { setProject(res.data); setLoading(false); });
  }, [id]);

  if (loading || !project) return <LoadingSpinner />;

  const rooms = project.rooms || {};
  const roomNames = Object.keys(rooms);
  const totalItems = roomNames.reduce((s, r) => s + rooms[r].length, 0);
  const completedItems = roomNames.reduce((s, r) => s + rooms[r].filter((i) => ["COMPLETED", "DISPATCHED", "DELIVERED"].includes(i.status)).length, 0);

  return (
    <div>
      <PageHeader title={project.project_number} subtitle={project.name}
        action={
          <div className="flex gap-2">
            <Link to="/work-orders/new"><Button size="sm" variant="outline"><Factory className="h-4 w-4 mr-1" />New Work Order</Button></Link>
            <Link to="/dispatches/new"><Button size="sm" variant="outline"><Truck className="h-4 w-4 mr-1" />New Dispatch</Button></Link>
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Status Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={project.status} />
                <div className="text-right">
                  <p className="text-sm text-gray-500">Estimated Cost</p>
                  <p className="text-xl font-bold">{formatINR(project.estimated_cost)}</p>
                </div>
              </div>
              {totalItems > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{completedItems} of {totalItems} items done</span>
                    <span>{totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room-wise Items */}
          {roomNames.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderKanban className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No items added to this project yet</p>
              </CardContent>
            </Card>
          ) : (
            roomNames.map((room) => (
              <Card key={room}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{room}</span>
                    <Badge variant="secondary" className="text-xs">{rooms[room].length} items</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rooms[room].map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 font-medium">{item.product_name ?? `Product #${item.product_id}`}</td>
                          <td className="px-4 py-2 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-center"><StatusBadge status={item.status} /></td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{item.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Project Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {project.client && (
                <div>
                  <span className="text-gray-500">Client: </span>
                  <Link to={`/clients/${project.client.id}`} className="font-medium text-indigo-600 hover:underline">{project.client.name}</Link>
                </div>
              )}
              {project.site_address && <div><span className="text-gray-500">Site: </span><span>{project.site_address}{project.city ? `, ${project.city}` : ""}</span></div>}
              {project.start_date && <div><span className="text-gray-500">Start: </span><span>{project.start_date}</span></div>}
              {project.target_completion_date && <div><span className="text-gray-500">Target: </span><span>{project.target_completion_date}</span></div>}
              {project.notes && <div className="pt-2 border-t"><span className="text-gray-500">Notes: </span><span className="text-gray-700">{project.notes}</span></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Cost Tracking</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Estimated</span><span className="font-medium">{formatINR(project.estimated_cost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Actual</span><span className="font-medium">{formatINR(project.actual_cost)}</span></div>
              {project.estimated_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Variance</span>
                  <span className={project.actual_cost > project.estimated_cost ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                    {formatINR(project.actual_cost - project.estimated_cost)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Room Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {roomNames.map((room) => {
                const roomItems = rooms[room];
                const done = roomItems.filter((i) => ["COMPLETED", "DISPATCHED", "DELIVERED"].includes(i.status)).length;
                return (
                  <div key={room} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{room}</span>
                    <span className={done === roomItems.length && roomItems.length > 0 ? "text-green-600 font-medium" : "text-gray-500"}>
                      {done}/{roomItems.length}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
