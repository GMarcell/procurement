import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  if (!isAdmin(user.role)) redirect("/products?error=Only+admins+can+edit+products.");

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${product.name}`}
        description="Update pricing or thresholds. Stock is managed in Inventory."
        back={
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to products
          </Link>
        }
      />
      <ProductForm
        product={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: Number(product.unitPrice),
          stockQty: product.stockQty,
          minStock: product.minStock,
          description: product.description ?? "",
          isActive: product.isActive,
        }}
      />
    </div>
  );
}
