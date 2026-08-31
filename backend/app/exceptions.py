from decimal import Decimal


class AppException(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code


class NotFoundError(AppException):
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", "NOT_FOUND", 404)


class ConflictError(AppException):
    def __init__(self, message: str):
        super().__init__(message, "CONFLICT", 409)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message, "FORBIDDEN", 403)


class BadRequestError(AppException):
    def __init__(self, message: str):
        super().__init__(message, "BAD_REQUEST", 400)


class InsufficientStockError(AppException):
    def __init__(self, material: str, required: Decimal, available: Decimal):
        super().__init__(
            f"Insufficient stock for {material}: required {required}, available {available}",
            "INSUFFICIENT_STOCK",
            400,
        )
        self.material = material
        self.required = required
        self.available = available


class ApprovalConflictError(AppException):
    def __init__(self, entity_type: str, admin_name: str):
        super().__init__(
            f"This {entity_type} has already been handled by {admin_name}",
            "APPROVAL_CONFLICT",
            409,
        )
