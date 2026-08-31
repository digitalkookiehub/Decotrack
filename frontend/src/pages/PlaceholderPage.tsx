import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction className="h-16 w-16 text-gray-300 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500">Coming soon</p>
    </div>
  );
}
