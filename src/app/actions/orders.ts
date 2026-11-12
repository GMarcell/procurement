"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { nextDocumentNumber } from "@/lib/numbering";
import { flash } from "@/lib/navigation";
import type { ActionState } from "@/lib/types";

const priceSchema = z.object({
  productId: z.string().min(1),
  unitPrice: z.coerce.number().positive("Every line needs a price above zero"),
});

export async function createPurchaseOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isAdmin(user.role)) {
    return { error: "Only procurement admins can create purchase orders." };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const expectedDateRaw = String(formData.get("expectedDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    include: {
      items: { include: { product: true } },
      vendor: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, status: true },
      },
    },
  });

  if (!request) return { error: "Purchase request not found." };
  const latestOrder = request.orders[0];
  if (latestOrder && latestOrder.status !== "REJECTED") {
    return { error: `This request already has an open purchase order (${latestOrder.number}).` };
  }
  if (request.status !== "ASSIGNED" || !request.vendor) {
    return { error: "Approve the request and assign a vendor first." };
  }

  let prices: { productId: string; unitPrice: number }[] = [];
  try {
    const parsed = z
      .array(priceSchema)
      .length(request.items.length, "A price is required for every line")
      .safeParse(JSON.parse(String(formData.get("prices") ?? "[]")));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid prices." };
    }
    prices = parsed.data;
  } catch {
    return { error: "Invalid price data." };
  }

  const priceByProduct = new Map(prices.map((price) => [price.productId, price.unitPrice]));
  const lines = request.items.map((item) => {
    const unitPrice = priceByProduct.get(item.productId);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: unitPrice ?? 0,
    };
  });

  if (lines.some((line) => !line.unitPrice || line.unitPrice <= 0)) {
    return { error: "Every line needs a price above zero." };
  }

  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const expectedDate = expectedDateRaw ? new Date(expectedDateRaw) : null;

  const order = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "PO");

    const created = await tx.purchaseOrder.create({
      data: {
        number,
        purchaseRequestId: request.id,
        vendorId: request.vendorId!,
        createdById: user.id,
        status: "PENDING",
        expectedDate:
          expectedDate && !Number.isNaN(expectedDate.getTime()) ? expectedDate : null,
        subtotal: total,
        total,
        notes: notes || null,
        items: { create: lines },
      },
    });

    await tx.purchaseRequest.update({
      where: { id: request.id },
      data: { status: "ORDERED" },
    });

    return created;
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${request.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  redirect(`/purchase-orders/${order.id}?notice=Purchase+order+created+and+sent+for+approval.`);
}

export async function approvePurchaseOrder(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  if (!canApprove(user.role)) {
    flash(`/purchase-orders/${id}`, "error", "Only approvers can approve purchase orders.");
  }

  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) flash("/purchase-orders", "error", "Purchase order not found.");
  if (order.status !== "PENDING") {
    flash(`/purchase-orders/${id}`, "error", "This order is no longer awaiting approval.");
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(`/purchase-orders/${id}`, "notice", "Purchase order approved. Payment and delivery can proceed.");
}

export async function rejectPurchaseOrder(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!canApprove(user.role)) {
    flash(`/purchase-orders/${id}`, "error", "Only approvers can reject purchase orders.");
  }
  if (reason.length < 3) {
    flash(`/purchase-orders/${id}`, "error", "Add a short reason for the rejection.");
  }

  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) flash("/purchase-orders", "error", "Purchase order not found.");
  if (order.status !== "PENDING") {
    flash(`/purchase-orders/${id}`, "error", "This order has already been decided.");
  }

  await prisma.$transaction([
    prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    }),
    // Send the request back to procurement so it can pick a vendor again and
    // raise a replacement order. Rejected orders stay in the history.
    prisma.purchaseRequest.updateMany({
      where: { id: order.purchaseRequestId, status: "ORDERED" },
      data: { status: "ASSIGNED" },
    }),
  ]);

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${order.purchaseRequestId}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(
    `/purchase-orders/${id}`,
    "notice",
    "Purchase order rejected. The request is back with procurement so it can be re-ordered.",
  );
}
