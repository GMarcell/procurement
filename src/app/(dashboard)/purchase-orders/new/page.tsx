import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { PageHeader } from "@/components/page-header";
import { PurchaseOrderForm } from "@/components/purchase-order-form";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const requestId = param(params, "requestId") ?? "";

  if (!isAdmin(user.role)) {
    redirect("/purchase-orders?error=Only+procurement+admins+can+create+purchase+orders.");
  }
  if (!requestId) redirect("/purchase-requests");

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    include: {
      items: { include: { product: true }, orderBy: { id: "asc" } },
      vendor: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, status: true },
      },
    },
  });

  if (!request) notFound();
  const latestOrder = request.orders[0];
  if (latestOrder && latestOrder.status !== "REJECTED") {
    redirect(`/purchase-orders/${latestOrder.id}`);
  }
  if (request.status !== "ASSIGNED" || !request.vendor) {
    redirect(
      `/purchase-requests/${request.id}?error=Approve+the+request+and+assign+a+vendor+first.`,
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Create purchase order"
        description={
          latestOrder
            ? `Replacement for ${latestOrder.number}, which was rejected. Confirm the vendor's prices and resubmit.`
            : "Confirm the vendor's prices and submit the order for approval."
        }
        back={
          <Link
            href={`/purchase-requests/${request.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {request.number}
          </Link>
        }
      />
      <PurchaseOrderForm
        requestId={request.id}
        requestNumber={request.number}
        vendorName={request.vendor.name}
        vendorTerms={request.vendor.paymentTerms}
        items={request.items.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          unit: item.product.unit,
          quantity: item.quantity,
          estimatedUnitPrice: Number(item.estimatedUnitPrice),
        }))}
      />
    </div>
  );
}
