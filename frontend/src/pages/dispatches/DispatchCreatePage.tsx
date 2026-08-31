import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, CheckSquare } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";

interface Project {
  id: number;
  project_number: string;
  name: string;
  site_address?: string;
  city?: string;
}

interface ProjectItem {
  id: number;
  room: string;
  product_id: number;
  product_name: string | null;
  quantity: number;
  status: string;
}

interface DriverInfo {
  id: number;
  name: string;
  phone: string;
  license_number: string | null;
  vehicle_number: string | null;
}

interface DispatchLineItem {
  project_item_id: number;
  product_id: number;
  product_name: string;
  room: string;
  project_qty: number;
  dispatch_qty: string;
  status: string;
  selected: boolean;
}

export function DispatchCreatePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectItems, setProjectItems] = useState<DispatchLineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/projects/?per_page=100")
      .then((res) => setProjects(res.data.items || []))
      .catch(() => {});
    api.get("/drivers/?per_page=50")
      .then((res) => setDrivers(res.data.items || []))
      .catch(() => {});
  }, []);

  const handleDriverSelect = (driverId: string) => {
    setSelectedDriverId(driverId);
    if (driverId) {
      const driver = drivers.find((d) => d.id === parseInt(driverId));
      if (driver) {
        setDriverName(driver.name);
        setDriverPhone(driver.phone);
        setVehicleNumber(driver.vehicle_number || "");
      }
    } else {
      setDriverName("");
      setDriverPhone("");
      setVehicleNumber("");
    }
  };

  // When project is selected, fetch its items grouped by room
  const handleProjectSelect = async (pid: string) => {
    setProjectId(pid);
    setProjectItems([]);

    if (!pid) return;

    setLoadingItems(true);
    try {
      const res = await api.get(`/projects/${pid}`);
      const project = res.data;
      const rooms: Record<string, ProjectItem[]> = project.rooms || {};

      // Auto-fill delivery address from project
      if (project.site_address) setDeliveryAddress(project.site_address);
      if (project.city) setDeliveryCity(project.city);

      // Flatten room items into dispatch line items
      const lines: DispatchLineItem[] = [];
      for (const [room, items] of Object.entries(rooms)) {
        for (const item of items as ProjectItem[]) {
          lines.push({
            project_item_id: item.id,
            product_id: item.product_id,
            product_name: item.product_name || `Product #${item.product_id}`,
            room,
            project_qty: item.quantity,
            dispatch_qty: String(item.quantity),
            status: item.status,
            selected: true, // Select all by default
          });
        }
      }
      setProjectItems(lines);
    } catch {
      toast.error("Failed to load project items");
    } finally {
      setLoadingItems(false);
    }
  };

  const toggleItem = (idx: number) => {
    const newItems = [...projectItems];
    newItems[idx] = { ...newItems[idx], selected: !newItems[idx].selected };
    setProjectItems(newItems);
  };

  const toggleAll = () => {
    const allSelected = projectItems.every((i) => i.selected);
    setProjectItems(projectItems.map((i) => ({ ...i, selected: !allSelected })));
  };

  const selectedItems = projectItems.filter((i) => i.selected);

  const handleSubmit = async (submitForApproval: boolean) => {
    if (!projectId) { toast.error("Select a project"); return; }
    if (selectedItems.length === 0) { toast.error("Select at least one item to dispatch"); return; }

    setSubmitting(true);
    try {
      const payload = {
        project_id: parseInt(projectId),
        vehicle_number: vehicleNumber || null,
        driver_name: driverName || null,
        driver_phone: driverPhone || null,
        delivery_address: deliveryAddress || null,
        delivery_city: deliveryCity || null,
        notes: notes || null,
        items: selectedItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: parseInt(i.dispatch_qty) || i.project_qty,
          project_item_id: i.project_item_id,
        })),
      };

      const res = await api.post("/dispatches/", payload);
      const dspId = res.data.id;

      if (submitForApproval) {
        await api.post(`/dispatches/${dspId}/submit`);
        toast.success("Dispatch created and submitted for approval");
      } else {
        toast.success("Dispatch saved as draft");
      }

      navigate(`/dispatches/${dspId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create dispatch";
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  // Group selected items by room for summary
  const roomSummary: Record<string, number> = {};
  for (const item of selectedItems) {
    roomSummary[item.room] = (roomSummary[item.room] || 0) + (parseInt(item.dispatch_qty) || item.project_qty);
  }

  return (
    <div>
      <PageHeader title="New Dispatch"
        action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <div className="grid gap-6">
        {/* Project Selection */}
        <Card>
          <CardHeader><CardTitle className="text-base">Select Project</CardTitle></CardHeader>
          <CardContent>
            <Label>Project *</Label>
            <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              value={projectId} onChange={(e) => handleProjectSelect(e.target.value)}>
              <option value="">-- Select project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* Project Items — auto-loaded */}
        {projectId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Project Items ({selectedItems.length} of {projectItems.length} selected)
              </CardTitle>
              {projectItems.length > 0 && (
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  {projectItems.every((i) => i.selected) ? "Deselect All" : "Select All"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingItems ? (
                <LoadingSpinner size="sm" text="Loading project items..." />
              ) : projectItems.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No items found in this project. Add items to the project first.</p>
              ) : (
                <div className="space-y-2">
                  {projectItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        item.selected ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => toggleItem(idx)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={item.selected}
                          onChange={() => toggleItem(idx)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-900 truncate">{item.product_name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <Badge variant="outline" className="text-[10px]">{item.room}</Badge>
                            <span>Project qty: {item.project_qty}</span>
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                        {item.selected && (
                          <div className="w-20 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Label className="text-[10px] text-gray-500">Dispatch qty</Label>
                            <Input
                              type="number"
                              min="1"
                              max={item.project_qty}
                              className="h-8 text-sm"
                              value={item.dispatch_qty}
                              onChange={(e) => {
                                const newItems = [...projectItems];
                                newItems[idx] = { ...newItems[idx], dispatch_qty: e.target.value };
                                setProjectItems(newItems);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery & Vehicle Info */}
        {projectId && selectedItems.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Delivery & Vehicle Info</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {/* Driver Selection */}
              <div>
                <Label>Select Driver *</Label>
                <select className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                  value={selectedDriverId} onChange={(e) => handleDriverSelect(e.target.value)}>
                  <option value="">-- Select a driver --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} — {d.phone}{d.vehicle_number ? ` — ${d.vehicle_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-filled driver details (editable) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Driver Name</Label>
                  <Input className="mt-1" placeholder="Driver name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                </div>
                <div>
                  <Label>Driver Phone</Label>
                  <Input className="mt-1" placeholder="9876543210" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Vehicle Number</Label>
                  <Input className="mt-1" placeholder="TN 01 AB 1234" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Delivery Address</Label>
                  <Textarea className="mt-1" placeholder="Site address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                </div>
                <div>
                  <Label>Delivery City</Label>
                  <Input className="mt-1" placeholder="City" value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea className="mt-1" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary + Actions */}
        {selectedItems.length > 0 && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Dispatch Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-indigo-50 p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-700">{selectedItems.length}</p>
                    <p className="text-xs text-indigo-600">Items</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-700">
                      {selectedItems.reduce((s, i) => s + (parseInt(i.dispatch_qty) || i.project_qty), 0)}
                    </p>
                    <p className="text-xs text-indigo-600">Total Units</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-700">{Object.keys(roomSummary).length}</p>
                    <p className="text-xs text-indigo-600">Rooms</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-600 mb-1">Rooms:</p>
                    {Object.entries(roomSummary).map(([room, qty]) => (
                      <p key={room} className="text-xs text-indigo-800">{room}: {qty} units</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Cancel</Button>
              <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={submitting}>Save as Draft</Button>
              <Button onClick={() => handleSubmit(true)} disabled={submitting}>Save & Submit for Approval</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
