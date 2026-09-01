import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";

import { NotFoundPage } from "./pages/NotFoundPage";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

// Real pages
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { MaterialListPage } from "./pages/inventory/MaterialListPage";
import { MaterialCreatePage } from "./pages/inventory/MaterialCreatePage";
import { MaterialDetailPage } from "./pages/inventory/MaterialDetailPage";
import { ReorderAlertPage } from "./pages/inventory/ReorderAlertPage";
import { VendorListPage } from "./pages/vendors/VendorListPage";
import { POListPage } from "./pages/purchase-orders/POListPage";
import { POCreatePage } from "./pages/purchase-orders/POCreatePage";
import { PODetailPage } from "./pages/purchase-orders/PODetailPage";
import { ClientListPage } from "./pages/clients/ClientListPage";
import { ProjectListPage } from "./pages/projects/ProjectListPage";
import { ProductListPage } from "./pages/products/ProductListPage";
import { ProductDetailPage } from "./pages/products/ProductDetailPage";
import { WOListPage } from "./pages/work-orders/WOListPage";
import { ApprovalInboxPage } from "./pages/approvals/ApprovalInboxPage";
import { GRNListPage } from "./pages/grn/GRNListPage";
import { GRNCreatePage } from "./pages/grn/GRNCreatePage";
import { GRNDetailPage } from "./pages/grn/GRNDetailPage";
import { DispatchListPage } from "./pages/dispatches/DispatchListPage";
import { DispatchCreatePage } from "./pages/dispatches/DispatchCreatePage";
import { DispatchDetailPage } from "./pages/dispatches/DispatchDetailPage";
import { LoadingVerificationPage } from "./pages/dispatches/LoadingVerificationPage";
import { WOCreatePage } from "./pages/work-orders/WOCreatePage";
import { WODetailPage } from "./pages/work-orders/WODetailPage";
import { ProductionBoardPage } from "./pages/work-orders/ProductionBoardPage";
import { ProductionOverviewPage } from "./pages/production/ProductionOverviewPage";
import { DriverDeliveryPage } from "./pages/delivery/DriverDeliveryPage";
import { ReportsHubPage } from "./pages/reports/ReportsHubPage";
import { StockReportPage } from "./pages/reports/StockReportPage";
import { PurchaseReportPage } from "./pages/reports/PurchaseReportPage";
import { WastageReportPage } from "./pages/reports/WastageReportPage";
import { AuditTrailPage } from "./pages/reports/AuditTrailPage";
import { DispatchReportPage } from "./pages/reports/DispatchReportPage";
import { ClientDetailPage } from "./pages/clients/ClientDetailPage";
import { ProjectCreatePage } from "./pages/projects/ProjectCreatePage";
import { ProjectDetailPage } from "./pages/projects/ProjectDetailPage";
import { VendorDetailPage } from "./pages/vendors/VendorDetailPage";
import { VendorCreatePage } from "./pages/vendors/VendorCreatePage";
import { ProductCreatePage } from "./pages/products/ProductCreatePage";
import { BOMEditorPage } from "./pages/products/BOMEditorPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { NotificationPage } from "./pages/notifications/NotificationPage";
import { UserManagementPage } from "./pages/admin/UserManagementPage";
import { FlowGuidePage } from "./pages/admin/FlowGuidePage";
import { SuggestionsPage } from "./pages/admin/SuggestionsPage";
import { DriverListPage } from "./pages/drivers/DriverListPage";
import { ExpenseListPage } from "./pages/expenses/ExpenseListPage";
import { CutPlannerPage } from "./pages/cutting/CutPlannerPage";
import { ElevationPage } from "./pages/elevation/ElevationPage";
import { QuotationListPage } from "./pages/quotations/QuotationListPage";
import { ClientPortalPage } from "./pages/portal/ClientPortalPage";
import { QuotationCreatePage } from "./pages/quotations/QuotationCreatePage";
import { CutlistRouter } from "./features/cutlist/CutlistRouter";
import { CutOrdersPage } from "./pages/cutting/CutOrdersPage";
import { CutOrderDetailPage } from "./pages/cutting/CutOrderDetailPage";
import { CRMDashboardPage } from "./pages/crm/CRMDashboardPage";
import { LeadListPage } from "./pages/crm/LeadListPage";
import { LeadDetailPage } from "./pages/crm/LeadDetailPage";
import { InteractionListPage } from "./pages/crm/InteractionListPage";
import { QuickLogCallPage } from "./pages/crm/QuickLogCallPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/portal" element={<ClientPortalPage />} />
            <Route
              path="/delivery/:token"
              element={<DriverDeliveryPage />}
            />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Inventory — REAL PAGES */}
              <Route path="inventory/materials" element={<MaterialListPage />} />
              <Route path="inventory/materials/new" element={<MaterialCreatePage />} />
              <Route path="inventory/materials/:id" element={<MaterialDetailPage />} />
              <Route path="inventory/alerts" element={<ReorderAlertPage />} />

              {/* Vendors — REAL PAGE */}
              <Route path="vendors" element={<VendorListPage />} />
              <Route path="vendors/new" element={<VendorCreatePage />} />
              <Route path="vendors/:id" element={<VendorDetailPage />} />

              {/* Purchase Orders — REAL PAGES */}
              <Route path="purchase-orders" element={<POListPage />} />
              <Route path="purchase-orders/new" element={<POCreatePage />} />
              <Route path="purchase-orders/:id" element={<PODetailPage />} />

              {/* GRN — REAL PAGES */}
              <Route path="grn" element={<GRNListPage />} />
              <Route path="grn/new" element={<GRNCreatePage />} />
              <Route path="grn/:id" element={<GRNDetailPage />} />

              {/* Clients — REAL PAGE */}
              <Route path="clients" element={<ClientListPage />} />
              <Route path="clients/new" element={<Navigate to="/clients" replace />} />
              <Route path="clients/:id" element={<ClientDetailPage />} />

              {/* Projects — REAL PAGE */}
              <Route path="projects" element={<ProjectListPage />} />
              <Route path="projects/new" element={<ProjectCreatePage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />

              {/* Products — REAL PAGES */}
              <Route path="products" element={<ProductListPage />} />
              <Route path="products/new" element={<ProductCreatePage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="products/:id/bom" element={<BOMEditorPage />} />

              {/* Work Orders — REAL PAGES */}
              <Route path="work-orders" element={<WOListPage />} />
              <Route path="work-orders/new" element={<WOCreatePage />} />
              <Route path="work-orders/:id" element={<WODetailPage />} />
              <Route path="work-orders/:id/production" element={<ProductionBoardPage />} />

              {/* Production — REAL PAGE */}
              <Route path="production" element={<ProductionOverviewPage />} />

              {/* Dispatch — REAL PAGES */}
              <Route path="dispatches" element={<DispatchListPage />} />
              <Route path="dispatches/new" element={<DispatchCreatePage />} />
              <Route path="dispatches/:id" element={<DispatchDetailPage />} />
              <Route path="dispatches/:id/loading" element={<LoadingVerificationPage />} />

              {/* Drivers */}
              <Route path="drivers" element={<DriverListPage />} />

              {/* Quotations */}
              <Route path="quotations" element={<QuotationListPage />} />
              <Route path="quotations/new" element={<QuotationCreatePage />} />

              {/* Elevation */}
              <Route path="elevation" element={<ElevationPage />} />

              {/* Cutlist Optimizer */}
              <Route path="cutlist/*" element={<CutlistRouter />} />

              {/* Cut Planner */}
              <Route path="cut-planner" element={<CutPlannerPage />} />
              <Route path="cut-orders" element={<CutOrdersPage />} />
              <Route path="cut-orders/:id" element={<CutOrderDetailPage />} />

              {/* Expenses */}
              <Route path="expenses" element={<ExpenseListPage />} />

              {/* CRM */}
              <Route path="crm" element={<CRMDashboardPage />} />
              <Route path="crm/leads" element={<LeadListPage />} />
              <Route path="crm/leads/:id" element={<LeadDetailPage />} />
              <Route path="crm/interactions" element={<InteractionListPage />} />
              <Route path="crm/quick-log" element={<QuickLogCallPage />} />
              <Route path="crm/followups" element={<CRMDashboardPage />} />

              {/* Reports — REAL PAGES */}
              <Route path="reports" element={<ReportsHubPage />} />
              <Route path="reports/stock" element={<StockReportPage />} />
              <Route path="reports/purchases" element={<PurchaseReportPage />} />
              <Route path="reports/wastage" element={<WastageReportPage />} />
              <Route path="reports/audit" element={<AuditTrailPage />} />
              <Route path="reports/dispatches" element={<DispatchReportPage />} />

              {/* Approvals — REAL PAGE */}
              <Route path="approvals" element={<ApprovalInboxPage />} />

              {/* Admin */}
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/flow-guide"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <FlowGuidePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/suggestions"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <SuggestionsPage />
                  </ProtectedRoute>
                }
              />

              {/* Profile & Notifications */}
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationPage />} />

              {/* 404 catch-all inside layout */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* 404 catch-all outside layout */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: "text-sm",
              style: { maxWidth: "400px" },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
