"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { nextDocumentNumber } from "@/lib/numbering";
import { flash } from "@/lib/navigation";
import type { ActionState } from "@/lib/types";

const paymentSchema = z.object({
  purchaseOrderId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  dueDate: z.string().trim().optional(),
  method: z.enum(["BANK_TRANSFER", "CASH", "CHEQUE", "CREDIT_CARD"]),
  notes: z.string().trim().max(500).optional(),
});

export async function createPaymentRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isAdmin(user.role)) {
    return { error: "Only procurement admins can create payment requests." };
  }

  const parsed = paymentSchema.safeParse({
    purchaseOrderId: formData.get("purchaseOrderId"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate") ?? undefined,
    method: formData.get("method"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment details." };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: parsed.data.purchaseOrderId },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, status: true },
      },
    },
  });

  if (!order) return { error: "Purchase order not found." };
  if (order.status !== "APPROVED" && order.status !== "PARTIALLY_RECEIVED") {
    return { error: "The purchase order must be approved before it can be paid." };
  }

  const latestPayment = order.payments[0];
  if (latestPayment && latestPayment.status !== "REJECTED") {
    return {
      error: `This order already has an open payment request (${latestPayment.number}).`,
    };
  }

  const total = Number(order.total);
  if (parsed.data.amount > total + 0.001) {
    return { error: `Amount cannot exceed the order total of $${total.toFixed(2)}.` };
  }

  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

  const payment = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "PAY");
    return tx.paymentRequest.create({
      data: {
        number,
        purchaseOrderId: order.id,
        amount: parsed.data.amount,
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
        method: parsed.data.method as PaymentMethod,
        notes: parsed.data.notes || null,
        status: "PENDING",
        requestedById: user.id,
      },
    });
  });

  revalidatePath("/payments");
  revalidatePath(`/purchase-orders/${order.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  redirect(`/payments/${payment.id}?notice=Payment+request+submitted+for+approval.`);
}

export async function approvePayment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  if (!canApprove(user.role)) {
    flash(`/payments/${id}`, "error", "Only approvers can approve payments.");
  }

  const payment = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!payment) flash("/payments", "error", "Payment request not found.");
  if (payment.status !== "PENDING") {
    flash(`/payments/${id}`, "error", "This payment is no longer awaiting approval.");
  }

  await prisma.paymentRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${id}`);
  revalidatePath(`/purchase-orders/${payment.purchaseOrderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(`/payments/${id}`, "notice", "Payment approved. Finance can settle it now.");
}

export async function rejectPayment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!canApprove(user.role)) {
    flash(`/payments/${id}`, "error", "Only approvers can reject payments.");
  }
  if (reason.length < 3) {
    flash(`/payments/${id}`, "error", "Add a short reason for the rejection.");
  }

  const payment = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!payment) flash("/payments", "error", "Payment request not found.");
  if (payment.status !== "PENDING") {
    flash(`/payments/${id}`, "error", "This payment has already been decided.");
  }

  await prisma.paymentRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionReason: reason,
    },
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${id}`);
  revalidatePath(`/purchase-orders/${payment.purchaseOrderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  flash(
    `/payments/${id}`,
    "notice",
    "Payment request rejected. Procurement can raise a replacement.",
  );
}

export async function markPaymentPaid(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  if (!isAdmin(user.role)) {
    flash(`/payments/${id}`, "error", "Only procurement admins can mark payments as paid.");
  }

  const payment = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!payment) flash("/payments", "error", "Payment request not found.");
  if (payment.status !== "APPROVED") {
    flash(`/payments/${id}`, "error", "Only an approved payment can be marked as paid.");
  }

  await prisma.paymentRequest.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${id}`);
  revalidatePath(`/purchase-orders/${payment.purchaseOrderId}`);
  revalidatePath("/dashboard");
  flash(`/payments/${id}`, "notice", "Payment recorded as paid.");
}
