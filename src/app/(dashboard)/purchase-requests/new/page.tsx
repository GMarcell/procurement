import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PurchaseRequestForm } from "@/components/purchase-request-form";

export default async function NewPurchaseRequestPage() {
  const user = await requirePageUser();
  if (user.role === "APPROVER") {
    redirect("/purchase-requests?error=Approvers+review+requests;+they+do+not+create+them.");
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, unit: true, unitPrice: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New purchase request"
        description="Submitting sends the request straight to an approver."
        back={
          <Link
            href="/purchase-requests"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to requests
          </Link>
        }
      />
      <PurchaseRequestForm
        products={products.map((product) => ({
          ...product,
          unitPrice: Number(product.unitPrice),
        }))}
        department="Operations"
      />
    </div>
  );
}
