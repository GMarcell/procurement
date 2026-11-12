import type { Role } from "@prisma/client";

/** Procurement admins run the process and maintain master data. */
export function isAdmin(role: Role) {
  return role === "ADMIN";
}

/** Approvers and admins can approve or reject documents. */
export function canApprove(role: Role) {
  return role === "APPROVER" || role === "ADMIN";
}

/** Only admins perform the operational steps. */
export function canOperate(role: Role) {
  return role === "ADMIN";
}
