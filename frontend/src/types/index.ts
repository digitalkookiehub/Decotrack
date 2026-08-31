// ── Status union types ──
export type UserRole = "EMPLOYEE" | "ADMIN";

export type POStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_RECEIVED"
  | "COMPLETED"
  | "CANCELLED";

export type WOStatus =
  | "PLANNING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type DispatchStatus =
  | "PENDING"
  | "LOADING_VERIFICATION"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ON_HOLD"
  | "CANCELLED";

export type GRNStatus = "DRAFT" | "COMPLETED";

export type ApprovalAction = "APPROVED" | "REJECTED";

export type DeliveryAcceptanceStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// ── Core models ──

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  auto_approve_po_threshold: number | null;
  auto_approve_wo_threshold: number | null;
  created_at: string;
  updated_at?: string;
}

export interface ItemCategory {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface RawMaterial {
  id: number;
  name: string;
  skuCode: string;
  categoryId: number;
  category: ItemCategory | null;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  reorderQty: number;
  lastPurchasePrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatch {
  id: number;
  rawMaterialId: number;
  rawMaterial: RawMaterial | null;
  batchNumber: string;
  quantity: number;
  remainingQty: number;
  unitPrice: number;
  receivedDate: string;
  expiryDate: string | null;
  grnId: number | null;
  createdAt: string;
}

export interface Vendor {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Purchase ──

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  rawMaterialId: number;
  rawMaterial: RawMaterial | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorId: number;
  vendor: Vendor | null;
  status: POStatus;
  totalAmount: number;
  notes: string | null;
  expectedDeliveryDate: string | null;
  createdById: number;
  createdBy: User | null;
  approvedById: number | null;
  approvedBy: User | null;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GRNItem {
  id: number;
  grnId: number;
  purchaseOrderItemId: number;
  purchaseOrderItem: PurchaseOrderItem | null;
  rawMaterialId: number;
  rawMaterial: RawMaterial | null;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unitPrice: number;
  batchNumber: string | null;
  remarks: string | null;
}

export interface GoodsReceivedNote {
  id: number;
  grnNumber: string;
  purchaseOrderId: number;
  purchaseOrder: PurchaseOrder | null;
  status: GRNStatus;
  receivedById: number;
  receivedBy: User | null;
  receivedDate: string;
  remarks: string | null;
  items: GRNItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalLog {
  id: number;
  entityType: string;
  entityId: number;
  action: ApprovalAction;
  approvedById: number;
  approvedBy: User | null;
  remarks: string | null;
  createdAt: string;
}

// ── Clients & Projects ──

export interface Client {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: number;
  projectId: number;
  finishedProductId: number;
  finishedProduct: FinishedProduct | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Project {
  id: number;
  name: string;
  clientId: number;
  client: Client | null;
  status: ProjectStatus;
  description: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  totalValue: number;
  items: ProjectItem[];
  createdAt: string;
  updatedAt: string;
}

// ── Products & BOM ──

export interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface BOMItem {
  id: number;
  finishedProductId: number;
  rawMaterialId: number;
  rawMaterial: RawMaterial | null;
  quantityRequired: number;
  unit: string;
  wastagePercent: number;
}

export interface FinishedProduct {
  id: number;
  name: string;
  skuCode: string;
  categoryId: number;
  category: ProductCategory | null;
  description: string | null;
  sellingPrice: number | null;
  bomItems: BOMItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FinishedGoodInventory {
  id: number;
  finishedProductId: number;
  finishedProduct: FinishedProduct | null;
  workOrderId: number;
  quantity: number;
  availableQty: number;
  producedDate: string;
  createdAt: string;
}

// ── Production ──

export interface WorkOrderItem {
  id: number;
  workOrderId: number;
  finishedProductId: number;
  finishedProduct: FinishedProduct | null;
  quantity: number;
  completedQty: number;
}

export interface WorkOrder {
  id: number;
  woNumber: string;
  projectId: number | null;
  project: Project | null;
  status: WOStatus;
  priority: string;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  createdById: number;
  createdBy: User | null;
  approvedById: number | null;
  approvedBy: User | null;
  items: WorkOrderItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionUnit {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ProductionStageLog {
  id: number;
  workOrderItemId: number;
  workOrderItem: WorkOrderItem | null;
  productionUnitId: number;
  productionUnit: ProductionUnit | null;
  stageName: string;
  startTime: string;
  endTime: string | null;
  quantityIn: number;
  quantityOut: number;
  operatorId: number;
  operator: User | null;
  notes: string | null;
  createdAt: string;
}

export interface WastageLog {
  id: number;
  productionStageLogId: number;
  productionStageLog: ProductionStageLog | null;
  rawMaterialId: number | null;
  rawMaterial: RawMaterial | null;
  quantity: number;
  unit: string;
  reason: string | null;
  createdAt: string;
}

// ── Dispatch ──

export interface DispatchItem {
  id: number;
  dispatchId: number;
  finishedProductId: number;
  finishedProduct: FinishedProduct | null;
  quantity: number;
  inventoryBatchId: number | null;
}

export interface DispatchPhoto {
  id: number;
  dispatchId: number;
  photoUrl: string;
  photoType: string;
  uploadedAt: string;
}

export interface Dispatch {
  id: number;
  dispatchNumber: string;
  projectId: number;
  project: Project | null;
  status: DispatchStatus;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  dispatchDate: string;
  deliveryDate: string | null;
  deliveryToken: string | null;
  clientAcceptanceStatus: DeliveryAcceptanceStatus;
  clientRemarks: string | null;
  items: DispatchItem[];
  photos: DispatchPhoto[];
  createdById: number;
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
}

// ── Notification ──

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  isRead: boolean;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
}

// ── CRM ──

export type LeadSource =
  | "INCOMING_CALL"
  | "OUTGOING_CALL"
  | "WHATSAPP"
  | "WALK_IN"
  | "REFERRAL"
  | "WEBSITE"
  | "INSTAGRAM"
  | "OTHER";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "SITE_VISIT"
  | "MEASUREMENT"
  | "QUOTATION_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type InteractionType =
  | "INCOMING_CALL"
  | "OUTGOING_CALL"
  | "WHATSAPP"
  | "EMAIL"
  | "SITE_VISIT"
  | "MEETING"
  | "NOTE";

export type CallSource = "MANUAL" | "ANDROID_APP";

export type FollowupStatus = "PENDING" | "COMPLETED" | "MISSED" | "CANCELLED";

export interface Lead {
  id: number;
  lead_number: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: number | null;
  assignee_name: string | null;
  client_id: number | null;
  project_id: number | null;
  estimated_value: number | null;
  notes: string | null;
  lost_reason: string | null;
  created_at: string;
}

export interface LeadDetail extends Lead {
  interactions: Interaction[];
  followups: FollowupItem[];
  measurements: LeadMeasurement[];
}

export interface LeadMeasurement {
  id: number;
  lead_id: number;
  room: string;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  notes: string | null;
  source: "AI_SCAN" | "MANUAL";
  created_at: string;
}

export interface Interaction {
  id: number;
  lead_id: number | null;
  client_id: number | null;
  interaction_type: InteractionType;
  logged_by: number;
  logger_name: string | null;
  phone_number: string | null;
  duration_seconds: number | null;
  summary: string | null;
  call_source: CallSource;
  ai_summary: string | null;
  ai_suggested_reply: string | null;
  created_at: string;
}

export interface FollowupItem {
  id: number;
  lead_id: number | null;
  client_id: number | null;
  assigned_to: number;
  assignee_name: string | null;
  lead_name: string | null;
  client_name: string | null;
  scheduled_at: string;
  notes: string | null;
  status: FollowupStatus;
  completed_at: string | null;
  created_at: string;
}

export interface CRMStats {
  pipeline: Record<string, number>;
  todays_followups: number;
  overdue_followups: number;
  recent_interactions_count: number;
  total_leads: number;
  won_value: number;
}

// ── Generic pagination ──

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
