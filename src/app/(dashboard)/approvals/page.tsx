import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ClipboardList, CreditCard, Inbox, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { canApprove } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  if (!canApprove(user.role)) {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("Approvals are only available to approvers and admins."),
    );
  }

  const params = await searchParams;

  const [requests, orders, payments] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { createdAt: "asc" },
      include: { requester: true, items: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { vendor: true, purchaseRequest: { include: { requester: true } } },
    }),
    prisma.paymentRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        requestedBy: true,
        purchaseOrder: { include: { vendor: true } },
      },
    }),
  ]);

  const total = requests.length + orders.length + payments.length;

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Everything waiting for a decision. Open a document to review its full history before approving or rejecting."
      />

      <FlashMessage notice={param(params, "notice")} error={param(params, "error")} />

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Nothing waiting"
            description="All purchase requests, orders, and payments have been decided."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Purchase requests (${requests.length})`}
              description="Approve to let procurement assign a vendor."
              action={<ClipboardList className="h-4 w-4 text-slate-400" />}
            />
            {requests.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No requests are waiting for approval.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Request</TH>
                    <TH>Requester</TH>
                    <TH>Submitted</TH>
                    <TH className="text-right">Estimated total</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {requests.map((request) => {
                    const amount = request.items.reduce(
                      (sum, item) =>
                        sum + item.quantity * Number(item.estimatedUnitPrice),
                      0,
                    );
                    return (
                      <TR key={request.id}>
                        <TD>
                          <p className="font-medium text-slate-900">{request.number}</p>
                          <p className="text-xs text-slate-500">{request.purpose}</p>
                        </TD>
                        <TD>
                          <p className="text-sm text-slate-900">{request.requester.name}</p>
                          <p className="text-xs text-slate-500">{request.department}</p>
                        </TD>
                        <TD className="whitespace-nowrap text-xs text-slate-500">
                          {formatDateTime(request.createdAt)}
                        </TD>
                        <TD className="tabular text-right font-medium text-slate-900">
                          {formatCurrency(amount)}
                        </TD>
                        <TD className="text-right">
                          <Link
                            href={`/purchase-requests/${request.id}`}
                            className={buttonClasses("primary", "sm")}
                          >
                            Review
                          </Link>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`Purchase orders (${orders.length})`}
              description="Approve to unlock the payment request and goods receipt."
              action={<ShoppingCart className="h-4 w-4 text-slate-400" />}
            />
            {orders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No purchase orders are waiting for approval.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Vendor</TH>
                    <TH>Requester</TH>
                    <TH>Ordered</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {orders.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <p className="font-medium text-slate-900">{order.number}</p>
                        <p className="text-xs text-slate-500">
                          From {order.purchaseRequest.number}
                        </p>
                      </TD>
                      <TD className="text-sm text-slate-900">{order.vendor.name}</TD>
                      <TD className="text-sm text-slate-700">
                        {order.purchaseRequest.requester.name}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-slate-500">
                        {formatDate(order.orderDate)}
                      </TD>
                      <TD className="tabular text-right font-medium text-slate-900">
                        {formatCurrency(order.total)}
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/purchase-orders/${order.id}`}
                          className={buttonClasses("primary", "sm")}
                        >
                          Review
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`Payment requests (${payments.length})`}
              description="Approved payments can then be marked as paid."
              action={<CreditCard className="h-4 w-4 text-slate-400" />}
            />
            {payments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No payment requests are waiting for approval.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Payment</TH>
                    <TH>Order</TH>
                    <TH>Raised by</TH>
                    <TH>Due</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {payments.map((payment) => (
                    <TR key={payment.id}>
                      <TD>
                        <p className="font-medium text-slate-900">{payment.number}</p>
                        <p className="text-xs text-slate-500">
                          {payment.purchaseOrder.vendor.name}
                        </p>
                      </TD>
                      <TD className="text-sm text-slate-700">
                        {payment.purchaseOrder.number}
                      </TD>
                      <TD className="text-sm text-slate-700">{payment.requestedBy.name}</TD>
                      <TD className="whitespace-nowrap text-xs text-slate-500">
                        {formatDate(payment.dueDate)}
                      </TD>
                      <TD className="tabular text-right font-medium text-slate-900">
                        {formatCurrency(payment.amount)}
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/payments/${payment.id}`}
                          className={buttonClasses("primary", "sm")}
                        >
                          Review
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {total > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Inbox className="h-3.5 w-3.5" />
          {total} document{total === 1 ? "" : "s"} waiting. Decisions are recorded with
          your name and time.
        </p>
      ) : null}
    </div>
  );
}
