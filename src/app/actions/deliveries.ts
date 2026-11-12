"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DeliveryCondition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { UserError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const deliverySchema = z.object({
  purchaseOrderId: z.string().min(1),
  receivedDate: z.string().trim().optional(),
  receivedBy: z.string().trim().min(2, "Who received the goods?").max(80),
  deliveryNoteNo: z.string().trim().max(60).optional(),
  condition: z.enum(["GOOD", "DAMAGED", "PARTIAL"]),
  notes: z.string().trim().max(500).optional(),
  proofUrl: z.string().trim().max(500).optional(),
});

const lineSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
});

export async function recordDelivery(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isAdmin(user.role)) {
    return { error: "Only procurement admins can record deliveries." };
  }

  const parsed = deliverySchema.safeParse({
    purchaseOrderId: formData.get("purchaseOrderId"),
    receivedDate: formData.get("receivedDate") ?? undefined,
    receivedBy: formData.get("receivedBy"),
    deliveryNoteNo: formData.get("deliveryNoteNo") ?? undefined,
    condition: formData.get("condition"),
    notes: formData.get("notes") ?? undefined,
    proofUrl: formData.get("proofUrl") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid delivery details." };
  }

  let lines: { purchaseOrderItemId: string; quantity: number }[];
  try {
    const result = z
      .array(lineSchema)
      .min(1, "The order has no lines to receive")
      .safeParse(JSON.parse(String(formData.get("items") ?? "[]")));
    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Invalid quantities." };
    }
    lines = result.data.filter((line) => line.quantity > 0);
  } catch {
    return { error: "Invalid delivery lines." };
  }

  if (lines.length === 0) {
    return { error: "Enter a received quantity for at least one line." };
  }

  const receivedDate = parsed.data.receivedDate
    ? new Date(parsed.data.receivedDate)
    : new Date();

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) throw new UserError("Purchase order not found.");
      if (order.status !== "APPROVED" && order.status !== "PARTIALLY_RECEIVED") {
        throw new UserError("Only an approved order can receive goods.");
      }

      const itemById = new Map(order.items.map((item) => [item.id, item]));

      for (const line of lines) {
        const item = itemById.get(line.purchaseOrderItemId);
        if (!item) throw new UserError("One of the delivery lines is not part of this order.");

        const remaining = item.quantity - item.receivedQty;
        if (line.quantity > remaining) {
          throw new UserError(
            `Cannot receive ${line.quantity} of ${item.product.name}; only ${remaining} remain.`,
          );
        }
      }

      const created = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: order.id,
          receivedDate: Number.isNaN(receivedDate.getTime()) ? new Date() : receivedDate,
          receivedBy: parsed.data.receivedBy,
          deliveryNoteNo: parsed.data.deliveryNoteNo || null,
          condition: parsed.data.condition as DeliveryCondition,
          notes: parsed.data.notes || null,
          proofUrl: parsed.data.proofUrl || null,
          recordedById: user.id,
          items: { create: lines },
        },
      });

      for (const line of lines) {
        const item = itemById.get(line.purchaseOrderItemId)!;

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: { increment: line.quantity } },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: line.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: line.quantity,
            reference: `${order.number} delivery`,
            note: parsed.data.deliveryNoteNo
              ? `Delivery note ${parsed.data.deliveryNoteNo}`
              : "Goods received",
            createdById: user.id,
          },
        });
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id },
      });
      const fullyReceived = refreshedItems.every(
        (item) => item.receivedQty >= item.quantity,
      );

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: fullyReceived ? "COMPLETED" : "PARTIALLY_RECEIVED" },
      });

      return created;
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${parsed.data.purchaseOrderId}`);
    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    redirect(
      `/purchase-orders/${parsed.data.purchaseOrderId}?notice=${encodeURIComponent(
        `Delivery ${receipt.deliveryNoteNo ?? ""} recorded. Stock updated.`.trim(),
      )}`,
    );
  } catch (error) {
    if (error instanceof UserError) {
      return { error: error.message };
    }
    throw error;
  }
}
