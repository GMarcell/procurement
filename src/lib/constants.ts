import type {
  DeliveryCondition,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
  OrderStatus,
  Role,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  APPROVER: "Approver",
  ADMIN: "Procurement admin",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  ASSIGNED: "Vendor assigned",
  ORDERED: "Ordered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PARTIALLY_RECEIVED: "Partially received",
  COMPLETED: "Completed",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CREDIT_CARD: "Credit card",
};

export const CONDITION_LABELS: Record<DeliveryCondition, string> = {
  GOOD: "Good",
  DAMAGED: "Damaged",
  PARTIAL: "Partial / incomplete",
};

export const DEPARTMENTS = [
  "Operations",
  "IT",
  "Finance",
  "Human Resources",
  "Warehouse",
  "Production",
  "Sales",
  "Marketing",
];

export const UNITS = ["pcs", "box", "pack", "set", "unit", "kg", "litre", "metre", "roll"];

export const PRODUCT_CATEGORIES = [
  "IT Equipment",
  "Office Supplies",
  "Furniture",
  "Industrial Supplies",
  "Safety Equipment",
  "Packaging",
  "Raw Materials",
  "Cleaning",
] as const;

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
export const DELIVERY_CONDITIONS = Object.keys(CONDITION_LABELS) as DeliveryCondition[];
