import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Bell, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import api from "../../services/api";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get("/notifications/unread-count")
      .then((res) => setUnreadCount(res.data.count || 0))
      .catch(() => {});
  }, [location.pathname]);

  const getTitle = () => {
    const path = location.pathname;
    if (path === "/dashboard") return "Dashboard";
    if (path.startsWith("/inventory/materials")) return "Raw Materials";
    if (path.startsWith("/inventory/alerts")) return "Reorder Alerts";
    if (path.startsWith("/vendors")) return "Vendors";
    if (path.startsWith("/purchase-orders")) return "Purchase Orders";
    if (path.startsWith("/grn")) return "Goods Received Notes";
    if (path.startsWith("/clients")) return "Clients";
    if (path.startsWith("/projects")) return "Projects";
    if (path.startsWith("/products")) return "Products";
    if (path.startsWith("/work-orders")) return "Work Orders";
    if (path.startsWith("/production")) return "Production";
    if (path.startsWith("/dispatches")) return "Dispatch";
    if (path.startsWith("/reports")) return "Reports";
    if (path.startsWith("/approvals")) return "Approvals";
    if (path.startsWith("/admin")) return "Admin";
    if (path.startsWith("/profile")) return "Profile";
    if (path.startsWith("/notifications")) return "Notifications";
    return "DecoTrack";
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-900 truncate">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-1">
        <Link to="/notifications" className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 transition-colors">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 sm:inline-block max-w-[120px] truncate">
                {user?.full_name ?? "User"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              <Badge variant="secondary" className="text-[10px] mt-1">{user?.role}</Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                <UserCircle className="h-4 w-4" />Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-red-600 focus:text-red-600 cursor-pointer">
              <LogOut className="h-4 w-4" />Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
