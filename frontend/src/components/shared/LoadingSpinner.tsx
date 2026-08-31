import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}

export function LoadingSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 gap-3", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-gray-200 border-t-indigo-600",
          sizeClasses[size]
        )}
      />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}
