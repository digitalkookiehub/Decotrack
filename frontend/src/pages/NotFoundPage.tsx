import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-indigo-600 mb-2">404</p>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />Go Back
          </Button>
          <Link to="/dashboard">
            <Button><Home className="h-4 w-4 mr-2" />Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
