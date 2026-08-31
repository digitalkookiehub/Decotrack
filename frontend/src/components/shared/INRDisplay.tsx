import { formatINR } from "../../lib/currency";
import { cn } from "../../lib/utils";

interface INRDisplayProps {
  amount: number;
  className?: string;
}

export function INRDisplay({ amount, className }: INRDisplayProps) {
  return (
    <span className={cn("font-medium text-gray-900", className)}>
      {formatINR(amount)}
    </span>
  );
}
