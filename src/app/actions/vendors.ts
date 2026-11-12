"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canOperate } from "@/lib/permissions";
import type { ActionState } from "@/lib/types";

const vendorSchema = z.object({
  code: z.string().trim().min(1, "Vendor code is required").max(30),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  contactName: z.string().trim().max(80).optional(),
  email: z
    .union([z.string().trim().email("Enter a valid email"), z.literal("")])
    .optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  paymentTerms: z.string().trim().min(1, "Payment terms are required").max(40),
});

export async function saveVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canOperate(user.role)) {
    return { error: "Only procurement admins can manage vendors." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const parsed = vendorSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    contactName: formData.get("contactName") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    address: formData.get("address") ?? undefined,
    paymentTerms: formData.get("paymentTerms"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vendor details." };
  }

  const data = {
    ...parsed.data,
    code: parsed.data.code.toUpperCase(),
    contactName: parsed.data.contactName || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    isActive: formData.get("isActive") === "on",
  };

  const duplicate = await prisma.vendor.findFirst({
    where: {
      code: { equals: data.code, mode: "insensitive" },
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    return { error: `Vendor code ${data.code} is already in use.` };
  }

  if (id) {
    await prisma.vendor.update({ where: { id }, data });
    revalidatePath("/vendors");
    redirect(`/vendors?notice=${encodeURIComponent(`${data.name} updated.`)}`);
  }

  await prisma.vendor.create({ data });
  revalidatePath("/vendors");
  redirect(`/vendors?notice=${encodeURIComponent(`${data.name} created.`)}`);
}
