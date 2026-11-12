import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = param(params, "q")?.trim() ?? "";
  const status = param(params, "status") ?? "";

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(status ? { status: status as Prisma.EnumOrderStatusFilter["equals"] } : {}),
    ...(user.role === "REQUESTER"
      ? { purchaseRequest: { requesterId: user.id } }
      : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { vendor: { name: { contains: q, mode: "insensitive" } } },
            { purchaseRequest: { number: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { name: true } },
      purchaseRequest: {
        select: { number: true, requester: { select: { name: true } } },
      },
      payments: {
        select: { status: true, method: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      items: { select: { quantity: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description="Committed orders with a vendor, awaiting approval, payment, and delivery."
      />

      <FlashMessage notice={param(params, "notice")} error={param(params, "error")} />

      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search PO, vendor, or request number"
              className="pl-9"
            />
          </div>
          <Select name="status" defaultValue={status} className="w-auto min-w-44">
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClasses("outline")}>
            Filter
          </button>
          {q || status ? (
            <Link
              href="/purchase-orders"
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase orders"
            description="Orders are created from approved requests with an assigned vendor."
            action={
              <Link href="/purchase-requests" className={buttonClasses("outline", "sm")}>
                Browse requests
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Vendor</TH>
                <TH>Request</TH>
                <TH className="text-right">Total</TH>
                <TH>Payment</TH>
                <TH>Status</TH>
                <TH>Ordered</TH>
              </TR>
            </THead>
            <TBody>
              {orders.map((order) => (
                <TR key={order.id}>
                  <TD>
                    <Link
                      href={`/purchase-orders/${order.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {order.number}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {order.items.length} line{order.items.length === 1 ? "" : "s"}
                    </p>
                  </TD>
                  <TD className="text-slate-700">{order.vendor.name}</TD>
                  <TD>
                    <p className="text-slate-700">{order.purchaseRequest.number}</p>
                    <p className="text-xs text-slate-500">
                      {order.purchaseRequest.requester.name}
                    </p>
                  </TD>
                  <TD className="tabular text-right font-medium text-slate-900">
                    {formatCurrency(order.total)}
                  </TD>
                  <TD>
                    {order.payments[0] ? (
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={order.payments[0].status} />
                        <span className="text-[11px] text-slate-400">
                          {PAYMENT_METHOD_LABELS[order.payments[0].method]}
                        </span>
                      </div>
                    ) : (
                      <Badge tone="slate">Not requested</Badge>
                    )}
                  </TD>
                  <TD>
                    <StatusBadge status={order.status} />
                  </TD>
                  <TD className="text-xs text-slate-500">
                    {formatDate(order.orderDate)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        {orders.length} order{orders.length === 1 ? "" : "s"} shown.
      </p>
    </div>
  );
}
