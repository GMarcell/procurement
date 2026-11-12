import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Wallet,
  X,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import {
  approvePayment,
  markPaymentPaid,
  rejectPayment,
} from "@/app/actions/payments";

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  const query = await searchParams;

  const payment = await prisma.paymentRequest.findUnique({
    where: { id },
    include: {
      requestedBy: true,
      approvedBy: true,
      purchaseOrder: {
        include: {
          vendor: true,
          purchaseRequest: { include: { requester: true } },
        },
      },
    },
  });

  if (!payment) notFound();
  if (
    user.role === "REQUESTER" &&
    payment.purchaseOrder.purchaseRequest.requesterId !== user.id
  ) {
    redirect("/payments?error=You+can+only+view+payments+for+your+own+requests.");
  }

  const canDecide = canApprove(user.role) && payment.status === "PENDING";
  const canMarkPaid = isAdmin(user.role) && payment.status === "APPROVED";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={payment.number}
        description={`Payment for ${payment.purchaseOrder.number} · ${payment.purchaseOrder.vendor.name}`}
        back={
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to payments
          </Link>
        }
        action={<StatusBadge status={payment.status} />}
      />

      <FlashMessage notice={param(query, "notice")} error={param(query, "error")} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Payment details" />
            <CardBody>
              <div className="mb-6 rounded-lg bg-slate-50 px-4 py-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Amount requested
                </p>
                <p className="tabular mt-1 text-3xl font-semibold text-slate-900">
                  {formatCurrency(payment.amount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  of {formatCurrency(payment.purchaseOrder.total)} order total
                </p>
              </div>

              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Method</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {PAYMENT_METHOD_LABELS[payment.method]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Due date</dt>
                  <dd className="mt-0.5 text-slate-900">{formatDate(payment.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Requested by</dt>
                  <dd className="mt-0.5 text-slate-900">{payment.requestedBy.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Requested on</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {formatDateTime(payment.createdAt)}
                  </dd>
                </div>
                {payment.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Notes</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-slate-700">
                      {payment.notes}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Linked purchase order"
              action={
                <Link
                  href={`/purchase-orders/${payment.purchaseOrder.id}`}
                  className={buttonClasses("outline", "sm")}
                >
                  Open order
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <CardBody className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Order</p>
                <p className="mt-0.5 font-medium text-slate-900">
                  {payment.purchaseOrder.number}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Vendor</p>
                <p className="mt-0.5 text-slate-900">
                  {payment.purchaseOrder.vendor.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Request</p>
                <p className="mt-0.5 text-slate-900">
                  {payment.purchaseOrder.purchaseRequest.number}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Requested by</p>
                <p className="mt-0.5 text-slate-900">
                  {payment.purchaseOrder.purchaseRequest.requester.name}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="space-y-4">
                <TimelineItem
                  done
                  title="Payment requested"
                  detail={`${payment.requestedBy.name} · ${formatDateTime(payment.createdAt)}`}
                />
                <TimelineItem
                  done={Boolean(payment.approvedAt)}
                  title={
                    payment.status === "REJECTED"
                      ? "Payment rejected"
                      : payment.approvedAt
                        ? "Payment approved"
                        : "Awaiting approval"
                  }
                  detail={
                    payment.approvedAt
                      ? `${payment.approvedBy?.name ?? "Approver"} · ${formatDateTime(payment.approvedAt)}`
                      : "An approver will review this payment."
                  }
                />
                <TimelineItem
                  done={Boolean(payment.paidAt)}
                  title="Payment settled"
                  detail={
                    payment.paidAt
                      ? formatDateTime(payment.paidAt)
                      : "Finance marks the payment as paid."
                  }
                />
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Actions" description="Available for your role." />
            <CardBody className="space-y-3">
              {canDecide ? (
                <>
                  <form action={approvePayment}>
                    <input type="hidden" name="id" value={payment.id} />
                    <Button type="submit" className="w-full">
                      <Check className="h-4 w-4" />
                      Approve payment
                    </Button>
                  </form>
                  <details className="rounded-lg border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      <X className="h-4 w-4" />
                      Reject payment
                    </summary>
                    <form
                      action={rejectPayment}
                      className="space-y-2 border-t border-slate-100 p-3"
                    >
                      <input type="hidden" name="id" value={payment.id} />
                      <Textarea
                        name="reason"
                        placeholder="Why is this payment rejected?"
                        required
                      />
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        Confirm rejection
                      </Button>
                    </form>
                  </details>
                </>
              ) : null}

              {canMarkPaid ? (
                <form action={markPaymentPaid}>
                  <input type="hidden" name="id" value={payment.id} />
                  <Button type="submit" className="w-full">
                    <Wallet className="h-4 w-4" />
                    Mark as paid
                  </Button>
                </form>
              ) : null}

              {payment.status === "PENDING" && !canDecide ? (
                <p className="text-xs text-slate-500">
                  Waiting for an approver to review this payment.
                </p>
              ) : null}

              {payment.status === "APPROVED" && !canMarkPaid ? (
                <p className="text-xs text-slate-500">
                  Approved. Procurement will record the payment once settled.
                </p>
              ) : null}

              {payment.status === "PAID" ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Paid on {formatDateTime(payment.paidAt)}.
                </p>
              ) : null}

              {payment.status === "REJECTED" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">Rejected</p>
                  <p className="mt-1 text-xs">{payment.rejectionReason}</p>
                </div>
              ) : null}

              {payment.approvedAt && payment.status !== "REJECTED" ? (
                <p className="text-xs text-slate-500">
                  Approved by {payment.approvedBy?.name ?? "approver"} on{" "}
                  {formatDateTime(payment.approvedAt)}.
                </p>
              ) : null}
            </CardBody>
          </Card>
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
