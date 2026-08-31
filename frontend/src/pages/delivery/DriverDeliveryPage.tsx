import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, Check, MapPin, Package, Truck, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import api from "../../services/api";

interface DeliveryItem {
  id: number;
  product_name: string;
  quantity: number;
  delivered_quantity: number | null;
  site_verified: boolean;
}

interface DeliveryInfo {
  dispatch_number: string;
  project_name: string | null;
  delivery_address: string | null;
  items: DeliveryItem[];
  photos_uploaded: number;
  min_photos_required: number;
  all_items_verified: boolean;
  can_complete: boolean;
}

export function DriverDeliveryPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<DeliveryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [photosCount, setPhotosCount] = useState(0);
  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>({});
  const [verifyingItem, setVerifyingItem] = useState<number | null>(null);

  const fetchInfo = () => {
    // Use axios without auth for public endpoint
    import("axios").then(({ default: axios }) => {
      const baseURL = import.meta.env.VITE_API_URL || "";
      axios.get(`${baseURL}/api/v1/delivery/${token}`)
        .then((res) => {
          setInfo(res.data);
          setPhotosCount(res.data.photos_uploaded);
          setQtyInputs((prev) => {
            const next = { ...prev };
            for (const item of res.data.items as DeliveryItem[]) {
              if (!(item.id in next)) next[item.id] = String(item.quantity);
            }
            return next;
          });
          setLoading(false);
        })
        .catch((err) => {
          const msg = err.response?.data?.detail || "Delivery link is invalid or expired";
          setError(msg);
          setLoading(false);
        });
    });
  };

  const handleVerifyItem = async (item: DeliveryItem) => {
    const qty = parseInt(qtyInputs[item.id] ?? String(item.quantity));
    if (isNaN(qty) || qty < 0 || qty > item.quantity) {
      alert(`Enter a quantity between 0 and ${item.quantity}`);
      return;
    }
    setVerifyingItem(item.id);
    try {
      const { default: axios } = await import("axios");
      const baseURL = import.meta.env.VITE_API_URL || "";
      const formData = new FormData();
      formData.append("delivered_quantity", String(qty));
      await axios.post(`${baseURL}/api/v1/delivery/${token}/verify-item/${item.id}`, formData);
      fetchInfo();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to confirm item";
      alert(msg);
    } finally {
      setVerifyingItem(null);
    }
  };

  useEffect(() => { fetchInfo(); }, [token]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Client-side compression via canvas
      const compressed = await compressImage(file);

      const formData = new FormData();
      formData.append("file", compressed, file.name);
      formData.append("item_reference", "site_delivery");
      formData.append("checkpoint", "SITE");

      // Get GPS if available
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        formData.append("gps_lat", String(pos.coords.latitude));
        formData.append("gps_lng", String(pos.coords.longitude));
      } catch {
        // GPS not available, continue without it
      }

      try {
        const { default: axios } = await import("axios");
        const baseURL = import.meta.env.VITE_API_URL || "";
        await axios.post(`${baseURL}/api/v1/delivery/${token}/photos`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setPhotosCount((prev) => prev + 1);
      } catch (uploadErr: unknown) {
        const errMsg = (uploadErr as { response?: { data?: { message?: string } } })?.response?.data?.message || "Photo upload failed";
        alert(errMsg);
      }
    }

    setUploading(false);
    e.target.value = "";
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { default: axios } = await import("axios");
      const baseURL = import.meta.env.VITE_API_URL || "";
      await axios.post(`${baseURL}/api/v1/delivery/${token}/complete`);
      setCompleted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to complete delivery";
      alert(msg);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Delivery Link Error</h2>
          <p className="text-sm text-gray-600">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (completed) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Delivery Completed</h2>
          <p className="text-sm text-gray-600">
            Thank you! The delivery has been marked as complete.
            The factory team will review your photos.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (!info) return null;

  const allItemsVerified = info.items.every((i) => i.site_verified);
  const canComplete = photosCount >= info.min_photos_required && allItemsVerified;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-5 w-5" />
            <span className="font-semibold">DecoTrack Delivery</span>
          </div>
          <p className="text-indigo-200 text-sm">{info.dispatch_number}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Delivery Info */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 text-lg">{info.project_name ?? "Delivery"}</h3>
            {info.delivery_address && (
              <p className="text-sm text-gray-600 flex items-start gap-1 mt-1">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {info.delivery_address}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Items — confirm quantity actually received at site */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Confirm Items Received</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              Enter how many of each item the customer actually received. If everything arrived, leave the quantity as-is and confirm.
            </p>
            <div className="space-y-3">
              {info.items.map((item) => (
                <div key={item.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{item.product_name}</span>
                    </div>
                    <Badge variant="secondary">expected x{item.quantity}</Badge>
                  </div>
                  {item.site_verified ? (
                    <div className={`flex items-center gap-2 text-sm ${item.delivered_quantity === item.quantity ? "text-green-600" : "text-amber-600"}`}>
                      <Check className="h-4 w-4" />
                      Confirmed: {item.delivered_quantity} of {item.quantity} received
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={qtyInputs[item.id] ?? String(item.quantity)}
                        onChange={(e) => setQtyInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <span className="text-sm text-gray-500">received</span>
                      <Button size="sm" className="ml-auto" disabled={verifyingItem === item.id}
                        onClick={() => handleVerifyItem(item)}>
                        {verifyingItem === item.id ? "Confirming..." : "Confirm"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Photo Upload */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Upload Delivery Photos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              Take photos showing the delivered items at the site.
              Minimum {info.min_photos_required} photos required.
            </p>

            <div className="flex items-center gap-3 mb-4">
              <div className={`text-2xl font-bold ${canComplete ? "text-green-600" : "text-amber-600"}`}>
                {photosCount}
              </div>
              <div className="text-sm text-gray-500">
                photo{photosCount !== 1 ? "s" : ""} uploaded
                {!canComplete && <span className="text-amber-600 ml-1">(need {info.min_photos_required - photosCount} more)</span>}
              </div>
            </div>

            <label className="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
              <div className="flex items-center justify-center gap-2 w-full py-4 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-600 font-medium cursor-pointer hover:bg-indigo-100 transition-colors">
                <Camera className="h-5 w-5" />
                {uploading ? "Uploading..." : "Take Photo / Upload"}
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Complete Button */}
        <Button
          className="w-full py-6 text-lg"
          disabled={!canComplete || completing}
          onClick={handleComplete}
        >
          {completing ? "Marking as Delivered..." : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Mark as Delivered
            </>
          )}
        </Button>

        {!canComplete && (
          <p className="text-center text-sm text-gray-400">
            {!allItemsVerified && "Confirm quantity received for every item. "}
            {photosCount < info.min_photos_required && `Upload at least ${info.min_photos_required} photos.`}
          </p>
        )}
      </div>
    </div>
  );
}

// Client-side image compression
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1200;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/jpeg",
        0.7
      );
    };
    img.src = URL.createObjectURL(file);
  });
}
