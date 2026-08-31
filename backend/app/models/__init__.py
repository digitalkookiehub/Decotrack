# Import all models so Alembic can discover them
from app.models.user import User, RefreshToken, UserRole  # noqa: F401
from app.models.raw_material import ItemCategory, RawMaterial, MaterialUnit  # noqa: F401
from app.models.inventory import InventoryBatch, InventoryMovement, MovementType  # noqa: F401
from app.models.vendor import Vendor  # noqa: F401
from app.models.driver import Driver  # noqa: F401
from app.models.expense import Expense, ExpenseCategory, PaymentMode  # noqa: F401
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, POStatus  # noqa: F401
from app.models.approval import ApprovalLog, EntityType, ApprovalAction  # noqa: F401
from app.models.grn import GoodsReceivedNote, GRNItem, QualityStatus  # noqa: F401
from app.models.client import Client  # noqa: F401
from app.models.project import Project, ProjectItem, ProjectStatus, ProjectItemStatus  # noqa: F401
from app.models.finished_product import ProductCategory, FinishedProduct, ProductUnit  # noqa: F401
from app.models.bom import BOMItem  # noqa: F401
from app.models.work_order import WorkOrder, WorkOrderItem, WOStatus, WOItemStatus  # noqa: F401
from app.models.production import (  # noqa: F401
    ProductionUnit,
    ProductionStageLog,
    WastageLog,
    MaterialIssue,
    ProductionStatus,
    StageStatus,
)
from app.models.dispatch import (  # noqa: F401
    Dispatch,
    DispatchItem,
    FinishedGoodInventory,
    DispatchStatus,
    FGStatus,
)
from app.models.dispatch_photo import DispatchPhoto, PhotoCheckpoint, PhotoUploaderRole  # noqa: F401
from app.models.notification import (  # noqa: F401
    Notification,
    EscalationTracker,
    NotificationType,
    NotificationChannel,
)
from app.models.cutting import CuttingPattern, JobType, CutOrderStatus  # noqa: F401
from app.models.quotation import Quotation, QuotationStatus  # noqa: F401
from app.models.company_profile import CompanyProfile  # noqa: F401
from app.models.cutlist import (  # noqa: F401
    CutJob,
    CutPart,
    CutResult,
    CutJobStatus,
    CutOrientation,
    CuttingMethod,
    OptimizationPriority,
    CutUnits,
)
from app.models.crm import (  # noqa: F401
    Lead,
    Interaction,
    Followup,
    LeadSource,
    LeadStatus,
    InteractionType,
    CallSource,
    FollowupStatus,
)
