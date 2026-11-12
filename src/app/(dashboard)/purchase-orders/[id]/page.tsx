import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  CreditCard,
  ExternalLink,
  PackageCheck,
  X,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  toDateInput,
} from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { StatusBadge } from "@/components/status-badge";
import { DeliveryForm } from "@/components/delivery-form";
import { PaymentForm } from "@/components/payment-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  approvePurchaseOrder,
  rejectPurchaseOrder,
} from "@/app/actions/orders";

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  const query = await searchParams;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      createdBy: true,
      approvedBy: true,
      purchaseRequest: { include: { requester: true } },
      items: { include: { product: true }, orderBy: { id: "asc" } },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { requestedBy: true, approvedBy: true },
      },
      receipts: {
        orderBy: { createdAt: "desc" },
        include: {
          recordedBy: true,
          items: {
            include: {
              purchaseOrderItem: { include: { product: true } },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();
  if (
    user.role === "REQUESTER" &&
    order.purchaseRequest.requesterId !== user.id
  ) {
    redirect("/purchase-orders?error=You+can+only+view+orders+from+your+own+requests.");
  }

  const latestPayment = order.payments[0];
  const canDecide = canApprove(user.role) && order.status === "PENDING";
  const canPay =
    isAdmin(user.role) &&
    (!latestPayment || latestPayment.status === "REJECTED") &&
    (order.status === "APPROVED" || order.status === "PARTIALLY_RECEIVED");
  const canReceive =
    isAdmin(user.role) &&
    (order.status === "APPROVED" || order.status === "PARTIALLY_RECEIVED") &&
    order.items.some((item) => item.receivedQty < item.quantity);

  const dueDate = toDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  return (
    <div>
      <PageHeader
        title={order.number}
        description={`Ordered from ${order.vendor.name}`}
        back={
          <Link
            href="/purchase-orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to orders
          </Link>
        }
        action={<StatusBadge status={order.status} />}
      />

      <FlashMessage notice={param(query, "notice")} error={param(query, "error")} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Order summary"
              description={`From ${order.purchaseRequest.number} · ${order.purchaseRequest.requester.name}`}
            />
            <CardBody className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Vendor</p>
                <p className="mt-0.5 font-medium text-slate-900">{order.vendor.name}</p>
                <p className="text-xs text-slate-500">{order.vendor.paymentTerms}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Order date</p>
                <p className="mt-0.5 text-slate-900">{formatDate(order.orderDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Expected delivery</p>
                <p className="mt-0.5 text-slate-900">{formatDate(order.expectedDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Created by</p>
                <p className="mt-0.5 text-slate-900">{order.createdBy.name}</p>
              </div>
              {order.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="mt-0.5 whitespace-pre-line text-slate-700">{order.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Order lines"
              description="Received quantities are updated when deliveries are recorded."
            />
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH className="text-right">Ordered</TH>
                  <TH className="text-right">Received</TH>
                  <TH className="text-right">Unit price</TH>
                  <TH className="text-right">Line total</TH>
                </TR>
              </THead>
              <TBody>
                {order.items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.product.sku} · per {item.product.unit}
                      </p>
                    </TD>
                    <TD className="tabular text-right text-slate-700">{item.quantity}</TD>
                    <TD className="tabular text-right">
                      <span
                        className={
                          item.receivedQty >= item.quantity
                            ? "font-medium text-emerald-600"
                            : "text-slate-700"
                        }
                      >
                        {item.receivedQty}
                      </span>
                      <span className="text-xs text-slate-400">
                        {" "}
                        / {item.quantity}
                      </span>
                    </TD>
                    <TD className="tabular text-right text-slate-700">
                      {formatCurrency(item.unitPrice)}
                    </TD>
                    <TD className="tabular text-right font-medium text-slate-900">
                      {formatCurrency(item.quantity * Number(item.unitPrice))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
              <span className="font-medium text-slate-600">Order total</span>
              <span className="tabular text-base font-semibold text-slate-900">
                {formatCurrency(order.total)}
              </span>
            </div>
          </Card>

          {latestPayment ? (
            <Card>
              <CardHeader
                title="Payment request"
                action={<StatusBadge status={latestPayment.status} />}
              />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatCurrency(latestPayment.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {latestPayment.number} ·{" "}
                      {PAYMENT_METHOD_LABELS[latestPayment.method]} · due{" "}
                      {formatDate(latestPayment.dueDate)}
                    </p>
                  </div>
                  <Link
                    href={`/payments/${latestPayment.id}`}
                    className={buttonClasses("outline", "sm")}
                  >
                    Open payment
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {latestPayment.rejectionReason ? (
                  <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    Rejected: {latestPayment.rejectionReason}
                  </p>
                ) : null}
                {canPay && latestPayment.status === "REJECTED" ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Raise a replacement payment request below.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {order.payments.length > 1 ? (
            <Card>
              <CardHeader
                title="Earlier payment requests"
                description="Previous attempts, newest first."
              />
              <CardBody className="space-y-2">
                {order.payments.slice(1).map((payment) => (
                  <Link
                    key={payment.id}
                    href={`/payments/${payment.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {payment.number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(payment.amount)} · {formatDate(payment.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {order.receipts.length > 0 ? (
            <Card>
              <CardHeader
                title="Deliveries"
                description={`${order.receipts.length} delivery record${order.receipts.length === 1 ? "" : "s"}`}
              />
              <CardBody className="space-y-4">
                {order.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {receipt.deliveryNoteNo ?? "Delivery"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(receipt.receivedDate)} · received by{" "}
                          {receipt.receivedBy} · recorded by {receipt.recordedBy.name}
                        </p>
                      </div>
                      <StatusBadge status={receipt.condition} />
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {receipt.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between gap-4 text-xs text-slate-600"
                        >
                          <span>{item.purchaseOrderItem.product.name}</span>
                          <span className="tabular font-medium text-slate-900">
                            +{item.quantity} {item.purchaseOrderItem.product.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {receipt.notes ? (
                      <p className="mt-2 text-xs text-slate-500">{receipt.notes}</p>
                    ) : null}
                    {receipt.proofUrl ? (
                      <a
                        href={receipt.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        View proof
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {canReceive ? (
            <DeliveryForm
              purchaseOrderId={order.id}
              orderNumber={order.number}
              defaultDate={toDateInput(new Date())}
              defaultReceiver={user.name}
              lines={order.items
                .filter((item) => item.receivedQty < item.quantity)
                .map((item) => ({
                  id: item.id,
                  productName: item.product.name,
                  sku: item.product.sku,
                  unit: item.product.unit,
                  ordered: item.quantity,
                  received: item.receivedQty,
                  remaining: item.quantity - item.receivedQty,
                }))}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Approval" />
            <CardBody className="space-y-3">
              {canDecide ? (
                <>
                  <form action={approvePurchaseOrder}>
                    <input type="hidden" name="id" value={order.id} />
                    <Button type="submit" className="w-full">
                      <Check className="h-4 w-4" />
                      Approve order
                    </Button>
                  </form>
                  <details className="rounded-lg border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      <X className="h-4 w-4" />
                      Reject order
                    </summary>
                    <form
                      action={rejectPurchaseOrder}
                      className="space-y-2 border-t border-slate-100 p-3"
                    >
                      <input type="hidden" name="id" value={order.id} />
                      <Textarea
                        name="reason"
                        placeholder="Why is this order rejected?"
                        required
                      />
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        Confirm rejection
                      </Button>
                    </form>
                  </details>
                </>
              ) : order.status === "PENDING" ? (
                <p className="text-xs text-slate-500">
                  Waiting for an approver. Payment and delivery unlock after approval.
                </p>
              ) : null}

              {order.approvedAt ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Approved by {order.approvedBy?.name ?? "approver"} on{" "}
                  {formatDateTime(order.approvedAt)}.
                </p>
              ) : null}

              {order.status === "REJECTED" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">Rejected</p>
                  <p className="mt-1 text-xs">{order.rejectionReason}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {canPay ? (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                Raise payment request
              </div>
              <PaymentForm
                purchaseOrderId={order.id}
                orderNumber={order.number}
                total={Number(order.total)}
                dueDate={dueDate}
              />
            </div>
          ) : null}

          {latestPayment && latestPayment.status === "PENDING" && canApprove(user.role) ? (
            <Link
              href={`/payments/${latestPayment.id}`}
              className={buttonClasses("primary", "md", "w-full")}
            >
              <CreditCard className="h-4 w-4" />
              Review payment request
            </Link>
          ) : null}

          <Card>
            <CardHeader title="Progress" />
            <CardBody>
              <ol className="space-y-4">
                <TimelineItem
                  done
                  title="Order created"
                  detail={`${order.createdBy.name} · ${formatDateTime(order.createdAt)}`}
                />
                <TimelineItem
                  done={Boolean(order.approvedAt) && order.status !== "REJECTED"}
                  title={order.status === "REJECTED" ? "Order rejected" : "Order approved"}
                  detail={
                    order.approvedAt
                      ? formatDateTime(order.approvedAt)
                      : "Awaiting approval"
                  }
                />
                <TimelineItem
                  done={Boolean(latestPayment)}
                  title="Payment request"
                  detail={
                    latestPayment
                      ? `${latestPayment.number} · ${latestPayment.status.replaceAll("_", " ").toLowerCase()}`
                      : "Not raised yet"
                  }
                />
                <TimelineItem
                  done={order.receipts.length > 0}
                  title="Goods received"
                  detail={
                    order.receipts.length > 0
                      ? `${order.receipts.length} delivery record${order.receipts.length === 1 ? "" : "s"}`
                      : "No deliveries yet"
                  }
                />
                <TimelineItem
                  done={order.status === "COMPLETED"}
                  title="Order complete"
                  detail={
                    order.status === "COMPLETED"
                      ? "All lines fully received"
                      : "Completes when every line is received"
                  }
                />
              </ol>
            </CardBody>
          </Card>

          {order.status === "COMPLETED" ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>All goods received. Stock and the movement ledger are up to date.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  done,
  title,
  detail,
}: {
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-slate-300" />
        )}
      </span>
      <div>
        <p className={`text-sm ${done ? "font-medium text-slate-900" : "text-slate-500"}`}>
          {title}
        </p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </li>
  );
}
