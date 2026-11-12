"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canOperate } from "@/lib/permissions";
import type { ActionState } from "@/lib/types";

const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  category: z.string().trim().min(2, "Category is required").max(60),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  unitPrice: z.coerce.number().positive("Unit price must be greater than 0"),
  minStock: z.coerce.number().int("Minimum stock must be a whole number").min(0),
  description: z.string().trim().max(500).optional(),
});

const stockSchema = z.coerce
  .number()
  .int("Opening stock must be a whole number")
  .min(0, "Opening stock cannot be negative");

export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canOperate(user.role)) {
    return { error: "Only procurement admins can manage products." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
    minStock: formData.get("minStock"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product details." };
  }

  const data = {
    ...parsed.data,
    sku: parsed.data.sku.toUpperCase(),
    description: parsed.data.description || null,
    isActive: formData.get("isActive") === "on",
  };

  const duplicate = await prisma.product.findFirst({
    where: {
      sku: { equals: data.sku, mode: "insensitive" },
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    return { error: `SKU ${data.sku} is already used by another product.` };
  }

  if (id) {
    await prisma.product.update({ where: { id }, data });
    revalidatePath("/products");
    revalidatePath("/inventory");
    redirect(`/products?notice=${encodeURIComponent(`${data.name} updated.`)}`);
  }

  const stock = stockSchema.safeParse(formData.get("stockQty") ?? 0);
  if (!stock.success) {
    return { error: stock.error.issues[0]?.message ?? "Invalid opening stock." };
  }

  await prisma.product.create({ data: { ...data, stockQty: stock.data } });
  revalidatePath("/products");
  revalidatePath("/inventory");
  redirect(`/products?notice=${encodeURIComponent(`${data.name} created.`)}`);
}
