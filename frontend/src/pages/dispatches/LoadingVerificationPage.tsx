import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Check, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";

interface DispatchItem {
  id: number;
  product_name: string;
  quantity: number;
  factory_verified: boolean;
}

export function LoadingVerificationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dispatch, setDispatch] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoCount, setPhotoCount] = useState<Record<number, number>>({});
  const [acting, setActing] = useState(false);

  const fetchDispatch = () => {
    api.get(`/dispatches/${id}`).then((res) => {
      setDispatch(res.data);
      setItems(res.data.items || []);
      // Count factory photos per item
      const photos = (res.data.photos || []) as Array<Record<string, unknown>>;
      const counts: Record<number, number> = {};
      for (const p of photos) {
        if (p.checkpoint === "FACTORY" && p.dispatch_item_id) {
          const itemId = p.dispatch_item_id as number;
          counts[itemId] = (counts[itemId] || 0) + 1;
        }
      }
      setPhotoCount(counts);
      setLoading(false);
    });
  };

  useEffect(() => { fetchDispatch(); }, [id]);

  const handleVerifyItem = async (itemId: number) => {
    try {
      await api.post(`/dispatches/${id}/verify-item/${itemId}`);
      toast.success("Item verified");
      fetchDispatch();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    }
  };

  const handleConfirmLoading = async () => {
    setActing(true);
    try {
      await api.post(`/dispatches/${id}/confirm-loading`);
      toast.success("Loading confirmed — dispatch in transit!");
      navigate(`/dispatches/${id}`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed — ensure all items are verified with photos");
    } finally { setActing(false); }
  };

  if (loading) return <LoadingSpinner />;

  const allVerified = items.every((item) => item.factory_verified);
  const allHavePhotos = items.every((item) => (photoCount[item.id] || 0) > 0);
  const canConfirm = allVerified && allHavePhotos;

  return (
    <div>
      <PageHeader
        title={`Loading Verification — ${(dispatch?.dispatch_number as string) || ""}`}
        subtitle="Verify each item and take photos before loading"
        action={<Button variant="outline" onClick={() => navigate(`/dispatches/${id}`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to Dispatch</Button>}
      />

      <div className="space-y-4">
        {items.map((item) => {
          const photos = photoCount[item.id] || 0;
          const verified = item.factory_verified;

          return (
            <Card key={item.id} className={verified ? "border-green-200 bg-green-50/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {verified ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{item.product_name}</p>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={photos > 0 ? "default" : "secondary"} className="text-xs">
                      <Camera className="h-3 w-3 mr-1" />{photos} photo{photos !== 1 ? "s" : ""}
                    </Badge>
                    {!verified && (
                      <Button size="sm" onClick={() => handleVerifyItem(item.id)}>
                        <Check className="h-4 w-4 mr-1" />Verify
                      </Button>
                    )}
                  </div>
                </div>

                {/* Photo upload area for this item */}
                <div className="mt-3 ml-9">
                  <label className="block cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("item_reference", item.product_name);
                        formData.append("dispatch_item_id", String(item.id));
                        try {
                          await api.post(`/dispatches/${id}/photos`, formData, {
                            headers: { "Content-Type": "multipart/form-data" },
                          });
                          setPhotoCount((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
                          toast.success("Photo uploaded");
                        } catch { toast.error("Photo upload failed"); }
                        e.target.value = "";
                      }} />
                    <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-50">
                      <Camera className="h-4 w-4" />
                      Take photo of {item.product_name}
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Truck overview photo */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                <Camera className="h-3 w-3 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Loaded Truck — Full View</p>
                <p className="text-sm text-gray-500">Take a photo of the fully loaded truck</p>
              </div>
            </div>
            <div className="mt-3 ml-9">
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={() => toast.success("Truck photo captured")} />
                <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-50">
                  <Camera className="h-4 w-4" />
                  Take photo of loaded truck
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Confirm Loading */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate(`/dispatches/${id}`)}>Cancel</Button>
          <Button
            onClick={handleConfirmLoading}
            disabled={!canConfirm || acting}
            className={canConfirm ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Check className="h-4 w-4 mr-2" />
            Confirm Loading Complete
          </Button>
        </div>

        {!canConfirm && (
          <p className="text-center text-sm text-amber-600">
            {!allVerified && "All items must be verified. "}
            {!allHavePhotos && "All items need at least one photo."}
          </p>
        )}
      </div>
    </div>
  );
}
