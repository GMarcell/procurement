import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Package,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  approvePurchaseRequest,
  assignVendor,
  cancelPurchaseRequest,
  rejectPurchaseRequest,
} from "@/app/actions/requests";

export default async function PurchaseRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  const query = await searchParams;

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      approvedBy: true,
      assignedBy: true,
      vendor: true,
      items: { include: { product: true }, orderBy: { id: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });

  if (!request) notFound();
  if (user.role === "REQUESTER" && request.requesterId !== user.id) {
    redirect("/purchase-requests?error=You+can+only+view+your+own+requests.");
  }

  const vendors = isAdmin(user.role)
    ? await prisma.vendor.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, paymentTerms: true },
      })
    : [];

  const total = request.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.estimatedUnitPrice),
    0,
  );

  const latestOrder = request.orders[0];
  const canDecide = canApprove(user.role) && request.status === "SUBMITTED";
  const canCancel =
    request.status === "SUBMITTED" &&
    (request.requesterId === user.id || isAdmin(user.role));
  const canAssign =
    isAdmin(user.role) &&
    (request.status === "APPROVED" ||
      (request.status === "ASSIGNED" && latestOrder?.status === "REJECTED"));
  const canCreateOrder =
    isAdmin(user.role) && request.status === "ASSIGNED" && Boolean(request.vendor);

  return (
    <div>
      <PageHeader
        title={request.number}
        description={request.purpose}
        back={
          <Link
            href="/purchase-requests"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to requests
          </Link>
        }
        action={<StatusBadge status={request.status} />}
      />

      <FlashMessage notice={param(query, "notice")} error={param(query, "error")} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Request details" />
            <CardBody>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Requester</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {request.requester.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Department</dt>
                  <dd className="mt-0.5 text-slate-900">{request.department}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Needed by</dt>
                  <dd className="mt-0.5 text-slate-900">{formatDate(request.neededBy)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Submitted</dt>
                  <dd className="mt-0.5 text-slate-900">{formatDateTime(request.createdAt)}</dd>
                </div>
                {request.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Notes</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-slate-700">
                      {request.notes}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Items"
              description={`${request.items.length} line${request.items.length === 1 ? "" : "s"} · estimated total ${formatCurrency(total)}`}
            />
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Est. unit price</TH>
                  <TH className="text-right">Line total</TH>
                </TR>
              </THead>
              <TBody>
                {request.items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.product.sku} · per {item.product.unit}
                      </p>
                    </TD>
                    <TD className="tabular text-right text-slate-700">
                      {item.quantity}
                    </TD>
                    <TD className="tabular text-right text-slate-700">
                      {formatCurrency(item.estimatedUnitPrice)}
                    </TD>
                    <TD className="tabular text-right font-medium text-slate-900">
                      {formatCurrency(item.quantity * Number(item.estimatedUnitPrice))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
              <span className="font-medium text-slate-600">Estimated total</span>
              <span className="tabular font-semibold text-slate-900">
                {formatCurrency(total)}
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="space-y-4">
                <TimelineItem
                  done
                  title="Request submitted"
                  detail={`${request.requester.name} · ${formatDateTime(request.createdAt)}`}
                />
                <TimelineItem
                  done={Boolean(request.approvedAt)}
                  title={
                    request.status === "REJECTED"
                      ? "Request rejected"
                      : request.approvedAt
                        ? "Request approved"
                        : "Awaiting approval"
                  }
                  detail={
                    request.approvedAt
                      ? `${request.approvedBy?.name ?? "Approver"} · ${formatDateTime(request.approvedAt)}`
                      : "An approver will review the request."
                  }
                />
                <TimelineItem
                  done={Boolean(request.assignedAt)}
                  title="Vendor assigned"
                  detail={
                    request.assignedAt
                      ? `${request.vendor?.name ?? "Vendor"} · ${formatDateTime(request.assignedAt)}`
                      : "Procurement assigns a vendor after approval."
                  }
                />
                <TimelineItem
                  done={Boolean(latestOrder)}
                  title="Purchase order"
                  detail={
                    latestOrder
                      ? `${latestOrder.number} (${latestOrder.status.replaceAll("_", " ").toLowerCase()})`
                      : "A purchase order is created from the assigned vendor."
                  }
                />
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Actions" description="Available for your role." />
            <CardBody className="space-y-4">
              {canDecide ? (
                <div className="space-y-3">
                  <form action={approvePurchaseRequest}>
                    <input type="hidden" name="id" value={request.id} />
                    <Button type="submit" className="w-full">
                      <Check className="h-4 w-4" />
                      Approve request
                    </Button>
                  </form>
                  <details className="rounded-lg border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      <X className="h-4 w-4" />
                      Reject request
                    </summary>
                    <form action={rejectPurchaseRequest} className="space-y-2 border-t border-slate-100 p-3">
                      <input type="hidden" name="id" value={request.id} />
                      <Textarea
                        name="reason"
                        placeholder="Why is this request rejected?"
                        required
                      />
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        Confirm rejection
                      </Button>
                    </form>
                  </details>
                </div>
              ) : null}

              {canCancel ? (
                <form action={cancelPurchaseRequest}>
                  <input type="hidden" name="id" value={request.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    <Ban className="h-4 w-4" />
                    Cancel request
                  </Button>
                </form>
              ) : null}

              {canAssign ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Store className="h-4 w-4 text-indigo-600" />
                    Assign a vendor
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Choose one supplier for this request.
                  </p>
                  <form action={assignVendor} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={request.id} />
                    <select
                      name="vendorId"
                      required
                      defaultValue=""
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="" disabled>
                        Select a vendor…
                      </option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name} ({vendor.paymentTerms})
                        </option>
                      ))}
                    </select>
                    <Textarea
                      name="vendorNote"
                      placeholder="Optional note about the choice"
                      className="min-h-16 bg-white"
                    />
                    <Button type="submit" className="w-full" size="sm">
                      Assign vendor
                    </Button>
                  </form>
                </div>
              ) : null}

              {latestOrder?.status === "REJECTED" ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {latestOrder.number} was rejected. Review the vendor and create
                  a replacement order when ready.
                </p>
              ) : null}

              {canCreateOrder ? (
                <Link
                  href={`/purchase-orders/new?requestId=${request.id}`}
                  className={buttonClasses("primary", "md", "w-full")}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {latestOrder?.status === "REJECTED"
                    ? "Create replacement order"
                    : "Create purchase order"}
                </Link>
              ) : null}

              {latestOrder ? (
                <Link
                  href={`/purchase-orders/${latestOrder.id}`}
                  className={buttonClasses("outline", "md", "w-full")}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  View {latestOrder.number}
                </Link>
              ) : null}

              {request.status === "REJECTED" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">Rejected</p>
                  <p className="mt-1 text-xs">{request.rejectionReason}</p>
                </div>
              ) : null}

              {request.status === "CANCELLED" ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  This request was cancelled.
                </p>
              ) : null}

              {request.status === "SUBMITTED" && !canDecide && user.role === "REQUESTER" ? (
                <p className="text-xs text-slate-500">
                  Waiting for an approver. You can cancel while it is still submitted.
                </p>
              ) : null}

              {request.status === "SUBMITTED" && isAdmin(user.role) ? (
                <p className="text-xs text-slate-500">
                  Waiting for approval. Vendor assignment unlocks after approval.
                </p>
              ) : null}

              {request.status === "APPROVED" && !isAdmin(user.role) ? (
                <p className="text-xs text-slate-500">
                  Approved. Procurement will assign a vendor next.
                </p>
              ) : null}

              {request.status === "ASSIGNED" && !isAdmin(user.role) ? (
                <p className="text-xs text-slate-500">
                  {latestOrder?.status === "REJECTED"
                    ? "The last order was rejected. Procurement is preparing a replacement."
                    : "Vendor assigned. Procurement will create the purchase order."}
                </p>
              ) : null}
            </CardBody>
          </Card>

          {request.orders.length > 0 ? (
            <Card>
              <CardHeader
                title="Purchase orders"
                description="Newest first. Rejected orders stay here for reference."
              />
              <CardBody className="space-y-2">
                {request.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/purchase-orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {order.number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(order.createdAt)} · {formatCurrency(order.total)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {request.vendor ? (
            <Card>
              <CardHeader title="Assigned vendor" />
              <CardBody className="space-y-2 text-sm">
                <p className="font-medium text-slate-900">{request.vendor.name}</p>
                <p className="text-xs text-slate-500">
                  {request.vendor.contactName ?? "No contact"} · {request.vendor.paymentTerms}
                </p>
                {request.vendorNote ? (
                  <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                    {request.vendorNote}
                  </p>
                ) : null}
                <p className="text-xs text-slate-400">
                  Assigned by {request.assignedBy?.name ?? "procurement"} on{" "}
                  {formatDate(request.assignedAt)}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-500">
            <p className="flex items-center gap-1.5 font-medium text-slate-600">
              <Package className="h-3.5 w-3.5" />
              What happens next?
            </p>
            <p className="mt-1">
              Approval → vendor assignment → purchase order → approval → payment
              and delivery → stock.
            </p>
          </div>
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
