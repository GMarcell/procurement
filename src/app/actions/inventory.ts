"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { UserError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const adjustmentSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().int().positive("Quantity must be a whole number above zero"),
  note: z.string().trim().min(3, "Add a reason for the adjustment").max(300),
});

export async function adjustStock(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isAdmin(user.role)) {
    return { error: "Only procurement admins can adjust stock." };
  }

  const parsed = adjustmentSchema.safeParse({
    productId: formData.get("productId"),
    direction: formData.get("direction"),
    quantity: formData.get("quantity"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid adjustment." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: parsed.data.productId },
      });
      if (!product) throw new UserError("Product not found.");

      if (parsed.data.direction === "OUT") {
        const result = await tx.product.updateMany({
          where: { id: product.id, stockQty: { gte: parsed.data.quantity } },
          data: { stockQty: { decrement: parsed.data.quantity } },
        });
        if (result.count === 0) {
          throw new UserError(
            `Not enough stock: ${product.name} has ${product.stockQty} ${product.unit} on hand.`,
          );
        }
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { stockQty: { increment: parsed.data.quantity } },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: parsed.data.direction,
          quantity: parsed.data.quantity,
          reference: "Manual adjustment",
          note: parsed.data.note,
          createdById: user.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect(`/inventory?notice=${encodeURIComponent("Stock adjusted and logged.")}`);
}
