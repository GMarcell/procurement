import Link from "next/link";
import { CreditCard, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = param(params, "q")?.trim() ?? "";
  const status = param(params, "status") ?? "";

  const where: Prisma.PaymentRequestWhereInput = {
    ...(status ? { status: status as Prisma.EnumPaymentStatusFilter["equals"] } : {}),
    ...(user.role === "REQUESTER"
      ? { purchaseOrder: { purchaseRequest: { requesterId: user.id } } }
      : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { purchaseOrder: { number: { contains: q, mode: "insensitive" } } },
            {
              purchaseOrder: {
                vendor: { name: { contains: q, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  const payments = await prisma.paymentRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      purchaseOrder: {
        include: { vendor: { select: { name: true } } },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Payment requests raised against approved purchase orders."
      />

      <FlashMessage notice={param(params, "notice")} error={param(params, "error")} />

      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search payment, PO, or vendor"
              className="pl-9"
            />
          </div>
          <Select name="status" defaultValue={status} className="w-auto min-w-44">
            <option value="">All statuses</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
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
              href="/payments"
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payment requests"
            description="Payments are requested after a purchase order is approved."
            action={
              <Link href="/purchase-orders" className={buttonClasses("outline", "sm")}>
                Browse purchase orders
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Payment</TH>
                <TH>Purchase order</TH>
                <TH>Vendor</TH>
                <TH className="text-right">Amount</TH>
                <TH>Method</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {payments.map((payment) => (
                <TR key={payment.id}>
                  <TD>
                    <Link
                      href={`/payments/${payment.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {payment.number}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {formatDate(payment.createdAt)}
                    </p>
                  </TD>
                  <TD>
                    <Link
                      href={`/purchase-orders/${payment.purchaseOrder.id}`}
                      className="text-slate-700 hover:text-indigo-600"
                    >
                      {payment.purchaseOrder.number}
                    </Link>
                  </TD>
                  <TD className="text-slate-700">{payment.purchaseOrder.vendor.name}</TD>
                  <TD className="tabular text-right font-medium text-slate-900">
                    {formatCurrency(payment.amount)}
                  </TD>
                  <TD className="text-xs text-slate-600">
                    {PAYMENT_METHOD_LABELS[payment.method]}
                  </TD>
                  <TD className="text-slate-600">{formatDate(payment.dueDate)}</TD>
                  <TD>
                    <StatusBadge status={payment.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        {payments.length} payment{payments.length === 1 ? "" : "s"} shown.
      </p>
    </div>
  );
}
