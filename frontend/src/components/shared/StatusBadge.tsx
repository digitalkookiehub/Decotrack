import { cn } from "../../lib/utils";

const statusColorMap: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-300",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-300",
  APPROVED: "bg-green-50 text-green-700 border-green-300",
  COMPLETED: "bg-green-50 text-green-700 border-green-300",
  DELIVERED: "bg-green-50 text-green-700 border-green-300",
  ACCEPTED: "bg-green-50 text-green-700 border-green-300",
  REJECTED: "bg-red-50 text-red-700 border-red-300",
  CANCELLED: "bg-red-50 text-red-700 border-red-300",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-300",
  IN_TRANSIT: "bg-blue-50 text-blue-700 border-blue-300",
  LOADING_VERIFICATION: "bg-blue-50 text-blue-700 border-blue-300",
  PARTIALLY_RECEIVED: "bg-blue-50 text-blue-700 border-blue-300",
  PLANNING: "bg-gray-100 text-gray-700 border-gray-300",
  PENDING: "bg-gray-100 text-gray-700 border-gray-300",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-300",
};

const defaultColor = "bg-gray-100 text-gray-700 border-gray-300";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const colorClasses = statusColorMap[status] ?? defaultColor;
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        colorClasses,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs"
      )}
    >
      {label}
    </span>
  );
}
