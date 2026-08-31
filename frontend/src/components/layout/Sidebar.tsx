import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  Building2,
  ShoppingCart,
  ClipboardCheck,
  FolderKanban,
  Users,
  Box,
  Factory,
  Hammer,
  Truck,
  Receipt,
  BarChart3,
  UserCog,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  PhoneCall,
  UserPlus,
  PhoneIncoming,
  CalendarClock,
  Scissors,
  Ruler,
  Workflow,
  Lightbulb,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../ui/badge";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [reportsOpen, setReportsOpen] = useState(false);

  const navGroups: NavGroup[] = [
    {
      label: "",
      items: [
        { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      // Pre-sale: enquiry through quotation, before there's a confirmed job.
      label: "CRM",
      items: [
        { label: "CRM Dashboard", to: "/crm", icon: PhoneCall },
        { label: "Leads", to: "/crm/leads", icon: UserPlus },
        { label: "Call Log", to: "/crm/interactions", icon: PhoneIncoming },
        { label: "Quick Log", to: "/crm/quick-log", icon: CalendarClock },
        { label: "Quotations", to: "/quotations", icon: Receipt },
      ],
    },
    {
      // The confirmed job: a client with a running project and its costs.
      label: "Projects",
      items: [
        { label: "Projects", to: "/projects", icon: FolderKanban },
        { label: "Clients", to: "/clients", icon: Users },
        { label: "Expenses", to: "/expenses", icon: Receipt },
      ],
    },
    {
      label: "Inventory",
      items: [
        { label: "Materials", to: "/inventory/materials", icon: Package },
        { label: "Reorder Alerts", to: "/inventory/alerts", icon: AlertTriangle },
      ],
    },
    {
      // Buying raw materials: pick a vendor, raise a PO, receive against it.
      label: "Purchase",
      items: [
        { label: "Vendors", to: "/vendors", icon: Building2 },
        { label: "Purchase Orders", to: "/purchase-orders", icon: ShoppingCart },
        { label: "GRN", to: "/grn", icon: ClipboardCheck },
      ],
    },
    {
      // Making the goods: catalog + BOM, work orders, stage tracking, cutting.
      label: "Production",
      items: [
        { label: "Products", to: "/products", icon: Box },
        { label: "Work Orders", to: "/work-orders", icon: Factory },
        { label: "Production", to: "/production", icon: Hammer },
        { label: "Elevation", to: "/elevation", icon: Ruler },
        { label: "Cut Planner", to: "/cut-planner", icon: Scissors },
        { label: "Cut Orders", to: "/cut-orders", icon: ClipboardCheck },
      ],
    },
    {
      // Getting the goods to site.
      label: "Dispatch",
      items: [
        { label: "Dispatch", to: "/dispatches", icon: Truck },
        { label: "Drivers", to: "/drivers", icon: Users },
      ],
    },
    {
      label: "Reports",
      collapsible: true,
      items: [
        { label: "Reports", to: "/reports", icon: BarChart3 },
      ],
    },
  ];

  const adminGroup: NavGroup = {
    label: "Admin",
    items: [
      { label: "Users", to: "/admin/users", icon: UserCog },
      { label: "Approvals", to: "/approvals", icon: CheckSquare },
      { label: "Flow Guide", to: "/admin/flow-guide", icon: Workflow },
      { label: "Suggestions", to: "/admin/suggestions", icon: Lightbulb },
    ],
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
              DT
            </div>
            <span className="text-lg font-bold text-gray-900">DecoTrack</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden rounded-md p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.label && !group.collapsible && (
                <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {group.label}
                </p>
              )}

              {group.collapsible ? (
                <div>
                  <button
                    onClick={() => setReportsOpen(!reportsOpen)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors",
                      isActive("/reports") && "bg-indigo-50 text-indigo-700"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5" />
                      Reports
                    </span>
                    {reportsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {reportsOpen && (
                    <div className="ml-8 mt-1 space-y-1">
                      {[
                        { to: "/reports/stock", label: "Stock Summary" },
                        { to: "/reports/purchases", label: "Purchases" },
                        { to: "/reports/wastage", label: "Wastage" },
                        { to: "/reports/audit", label: "Audit Trail" },
                        { to: "/reports/dispatches", label: "Dispatches" },
                        { to: "/expenses", label: "Expenses" },
                      ].map((r) => (
                        <NavLink
                          key={r.to}
                          to={r.to}
                          className={({ isActive: active }) =>
                            cn(
                              "block rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors",
                              active && "bg-indigo-600 text-white hover:bg-indigo-700"
                            )
                          }
                        >
                          {r.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive: active }) =>
                      cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-indigo-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))
              )}
            </div>
          ))}

          {/* Admin section */}
          {isAdmin() && (
            <div>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Admin
              </p>
              {adminGroup.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive: active }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* User card */}
        {user && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.full_name}
                </p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {user.role}
                </Badge>
              </div>
              <button
                onClick={logout}
                className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
