import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/product-form";

export default async function NewProductPage() {
  const user = await requirePageUser();
  if (!isAdmin(user.role)) redirect("/products?error=Only+admins+can+add+products.");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New product"
        description="Add an item that can be requested and purchased."
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
      <ProductForm />
    </div>
  );
}
