"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { nextDocumentNumber } from "@/lib/numbering";
import { flash } from "@/lib/navigation";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/types";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  estimatedUnitPrice: z.coerce.number().min(0),
});

const requestSchema = z.object({
  department: z.string().trim().min(2, "Department is required"),
  purpose: z.string().trim().min(5, "Describe the purpose (at least 5 characters)").max(500),
  neededBy: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
});

function cleanItems(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return null;

  try {
    const parsedJson = JSON.parse(raw);
    const parsed = z.array(itemSchema).min(1, "Add at least one product").safeParse(parsedJson);
    if (!parsed.success) return null;

    // Merge duplicate product lines so one product appears once per request.
    const merged = new Map<string, z.infer<typeof itemSchema>>();
    for (const item of parsed.data) {
      const existing = merged.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.set(item.productId, { ...item });
      }
    }
    return [...merged.values()];
  } catch {
    return null;
  }
}

export async function createPurchaseRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role === "APPROVER") {
    return { error: "Approvers review requests; they do not create them." };
  }

  const parsed = requestSchema.safeParse({
    department: formData.get("department"),
    purpose: formData.get("purpose"),
    neededBy: formData.get("neededBy") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request details." };
  }

  const items = cleanItems(formData.get("items"));
  if (!items) {
    return { error: "Add at least one product with a valid quantity and price." };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) }, isActive: true },
    select: { id: true },
  });
  if (products.length !== items.length) {
    return { error: "One of the selected products is no longer available." };
  }

  const neededBy = parsed.data.neededBy ? new Date(parsed.data.neededBy) : null;

  const request = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "PR");
    return tx.purchaseRequest.create({
      data: {
        number,
        requesterId: user.id,
        department: parsed.data.department,
        purpose: parsed.data.purpose,
        neededBy: neededBy && !Number.isNaN(neededBy.getTime()) ? neededBy : null,
        notes: parsed.data.notes || null,
        status: "SUBMITTED",
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            estimatedUnitPrice: item.estimatedUnitPrice,
          })),
        },
      },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  redirect(`/purchase-requests/${request.id}?notice=Request+submitted+for+approval.`);
}

export async function approvePurchaseRequest(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  if (!canApprove(user.role)) {
    flash(`/purchase-requests/${id}`, "error", "Only approvers can approve requests.");
  }

  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request) flash("/purchase-requests", "error", "Purchase request not found.");
  if (request.status !== "SUBMITTED") {
    flash(`/purchase-requests/${id}`, "error", "This request is no longer awaiting approval.");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(`/purchase-requests/${id}`, "notice", "Purchase request approved. Assign a vendor next.");
}

export async function rejectPurchaseRequest(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!canApprove(user.role)) {
    flash(`/purchase-requests/${id}`, "error", "Only approvers can reject requests.");
  }
  if (reason.length < 3) {
    flash(`/purchase-requests/${id}`, "error", "Add a short reason for the rejection.");
  }

  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request) flash("/purchase-requests", "error", "Purchase request not found.");
  if (request.status !== "SUBMITTED") {
    flash(`/purchase-requests/${id}`, "error", "This request has already been decided.");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionReason: reason,
    },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(`/purchase-requests/${id}`, "notice", "Purchase request rejected.");
}

export async function cancelPurchaseRequest(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request) flash("/purchase-requests", "error", "Purchase request not found.");
  if (request.requesterId !== user.id && !isAdmin(user.role)) {
    flash(`/purchase-requests/${id}`, "error", "You can only cancel your own requests.");
  }
  if (request.status !== "SUBMITTED") {
    flash(`/purchase-requests/${id}`, "error", "Only a request that is still submitted can be cancelled.");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/dashboard");
  flash(`/purchase-requests/${id}`, "notice", "Purchase request cancelled.");
}

export async function assignVendor(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const vendorNote = String(formData.get("vendorNote") ?? "").trim();

  if (!isAdmin(user.role)) {
    flash(`/purchase-requests/${id}`, "error", "Only procurement admins can assign vendors.");
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      },
    },
  });
  if (!request) flash("/purchase-requests", "error", "Purchase request not found.");

  const latestOrder = request.orders[0];
  if (latestOrder && latestOrder.status !== "REJECTED") {
    flash(`/purchase-requests/${id}`, "error", "A purchase order already exists for this request.");
  }

  const canAssignVendor =
    request.status === "APPROVED" ||
    (request.status === "ASSIGNED" && latestOrder?.status === "REJECTED");
  if (!canAssignVendor) {
    flash(
      `/purchase-requests/${id}`,
      "error",
      "Assign a vendor only after approval or after an order was rejected.",
    );
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor || !vendor.isActive) {
    flash(`/purchase-requests/${id}`, "error", "Choose an active vendor.");
  }

  await prisma.purchaseRequest.update({
    where: { id },
    data: {
      vendorId,
      vendorNote: vendorNote || null,
      assignedById: user.id,
      assignedAt: new Date(),
      status: "ASSIGNED",
    },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(`/purchase-requests/${id}`, "notice", `${vendor.name} assigned. Create the purchase order next.`);
}
