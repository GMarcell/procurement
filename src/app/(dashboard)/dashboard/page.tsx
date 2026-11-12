import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Inbox,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { canApprove, isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function requestTotal(items: { quantity: number; estimatedUnitPrice: unknown }[]) {
  return items.reduce(
    (sum, item) => sum + item.quantity * Number(item.estimatedUnitPrice),
    0,
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const isRequester = user.role === "REQUESTER";
  const approver = canApprove(user.role);

  const requestScope: Prisma.PurchaseRequestWhereInput = isRequester
    ? { requesterId: user.id }
    : {};

  const [
    openRequests,
    pendingOrders,
    pendingPayments,
    lowStockProducts,
    recentRequests,
    paidThisMonth,
    paidForTrend,
    pendingRequestList,
    pendingOrderList,
    pendingPaymentList,
    rejectedOrderRequests,
    rejectedPaymentRows,
  ] = await Promise.all([
    prisma.purchaseRequest.count({
      where: {
        ...requestScope,
        status: { in: ["SUBMITTED", "APPROVED", "ASSIGNED"] },
      },
    }),
    prisma.purchaseOrder.count({
      where: { status: "PENDING", ...(isRequester ? { purchaseRequest: { requesterId: user.id } } : {}) },
    }),
    prisma.paymentRequest.count({
      where: {
        status: "PENDING",
        ...(isRequester
          ? { purchaseOrder: { purchaseRequest: { requesterId: user.id } } }
          : {}),
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { stockQty: "asc" },
      take: 20,
    }),
    prisma.purchaseRequest.findMany({
      where: requestScope,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { requester: true, items: true, vendor: true },
    }),
    prisma.paymentRequest.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfMonth() } },
      _sum: { amount: true },
    }),
    prisma.paymentRequest.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: new Date(startOfMonth().getFullYear(), startOfMonth().getMonth() - 5, 1) },
      },
      select: { amount: true, paidAt: true },
    }),
    approver
      ? prisma.purchaseRequest.findMany({
          where: { status: "SUBMITTED" },
          orderBy: { createdAt: "asc" },
          take: 4,
          include: { requester: true, items: true },
        })
      : Promise.resolve([]),
    approver
      ? prisma.purchaseOrder.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 4,
          include: { vendor: true },
        })
      : Promise.resolve([]),
    approver
      ? prisma.paymentRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 4,
          include: { purchaseOrder: { include: { vendor: true } } },
        })
      : Promise.resolve([]),
    prisma.purchaseRequest.findMany({
      where: {
        status: "ASSIGNED",
        ...(isRequester ? { requesterId: user.id } : {}),
        orders: { some: { status: "REJECTED" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        vendor: { select: { name: true } },
        orders: {
          where: { status: "REJECTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, number: true, total: true, updatedAt: true },
        },
      },
    }),
    prisma.paymentRequest.findMany({
      where: {
        status: "REJECTED",
        ...(isRequester
          ? { purchaseOrder: { purchaseRequest: { requesterId: user.id } } }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            number: true,
            vendor: { select: { name: true } },
            payments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);

  const lowStock = lowStockProducts.filter(
    (product) => product.stockQty <= product.minStock,
  );

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      startOfMonth().getFullYear(),
      startOfMonth().getMonth() - 5 + index,
      1,
    );
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: monthLabel(date),
      total: 0,
    };
  });

  for (const payment of paidForTrend) {
    if (!payment.paidAt) continue;
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    const bucket = months.find((month) => month.key === key);
    if (bucket) bucket.total += Number(payment.amount);
  }

  const peak = Math.max(...months.map((month) => month.total), 1);
  const pendingTotal =
    pendingRequestList.length + pendingOrderList.length + pendingPaymentList.length;
  const firstName = user.name.split(" ")[0];

  const rejectedPayments = rejectedPaymentRows.filter(
    (payment) => payment.purchaseOrder.payments[0]?.id === payment.id,
  );
  const replacements = [
    ...rejectedOrderRequests.flatMap((request) => {
      const order = request.orders[0];
      if (!order) return [];
      return [
        {
          key: `order-${order.id}`,
          kind: "order" as const,
          href: `/purchase-requests/${request.id}`,
          title: `${order.number} · ${request.vendor?.name ?? "No vendor"}`,
          detail: `Rejected order for ${request.number}`,
          amount: order.total,
          rejectedAt: order.updatedAt,
          action: "Order again",
        },
      ];
    }),
    ...rejectedPayments.map((payment) => ({
      key: `payment-${payment.id}`,
      kind: "payment" as const,
      href: `/purchase-orders/${payment.purchaseOrder.id}`,
      title: `${payment.number} · ${payment.purchaseOrder.vendor.name}`,
      detail: `Rejected payment for ${payment.purchaseOrder.number}`,
      amount: payment.amount,
      rejectedAt: payment.updatedAt,
      action: "Raise again",
    })),
  ]
    .sort((a, b) => b.rejectedAt.getTime() - a.rejectedAt.getTime())
    .slice(0, 5);

  const kpis = [
    {
      label: "Open requests",
      value: String(openRequests),
      hint: "Submitted, approved, or vendor assigned",
      icon: ClipboardList,
      href: "/purchase-requests",
    },
    {
      label: "Orders to approve",
      value: String(pendingOrders),
      hint: "Purchase orders pending approval",
      icon: ShoppingCart,
      href: "/purchase-orders?status=PENDING",
    },
    {
      label: "Payments to approve",
      value: String(pendingPayments),
      hint: "Payment requests waiting",
      icon: CreditCard,
      href: "/payments?status=PENDING",
    },
    {
      label: "Spent this month",
      value: formatCurrency(paidThisMonth._sum.amount ?? 0),
      hint: "Payments settled since the 1st",
      icon: TrendingUp,
      href: "/payments?status=PAID",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Where every purchase stands right now, from request to shelf."
        action={
          user.role === "APPROVER" ? null : (
            <Link href="/purchase-requests/new" className={buttonClasses("primary")}>
              <Plus className="h-4 w-4" />
              New request
            </Link>
          )
        }
      />

      <FlashMessage notice={param(params, "notice")} error={param(params, "error")} />

      {replacements.length > 0 ? (
        <Card className="mb-6 border-amber-200">
          <CardHeader
            title="Needs a replacement"
            description="Rejected orders and payments that can be raised again."
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <TriangleAlert className="h-3.5 w-3.5" />
                {replacements.length} waiting
              </span>
            }
          />
          <div className="divide-y divide-amber-100">
            {replacements.map((item) => {
              const Icon = item.kind === "order" ? ShoppingCart : CreditCard;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-amber-50/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.detail} · rejected {formatDate(item.rejectedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-sm text-slate-700">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="hidden items-center gap-1 text-xs font-medium text-indigo-600 sm:inline-flex">
                      {item.action}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-indigo-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="tabular mt-2 text-2xl font-semibold text-slate-900">
                  {kpi.value}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{kpi.hint}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {approver ? (
            <Card>
              <CardHeader
                title="Waiting for your decision"
                description="Requests, orders, and payments that need an approver."
                action={
                  <Link
                    href="/approvals"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Open queue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              {pendingTotal === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="You are all caught up"
                  description="Nothing is waiting for approval right now."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingRequestList.map((request) => (
                    <Link
                      key={request.id}
                      href={`/purchase-requests/${request.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {request.number} · {request.purpose}
                        </p>
                        <p className="text-xs text-slate-500">
                          Purchase request · {request.requester.name} ·{" "}
                          {request.department}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular text-sm text-slate-700">
                          {formatCurrency(requestTotal(request.items))}
                        </span>
                        <StatusBadge status={request.status} />
                      </div>
                    </Link>
                  ))}
                  {pendingOrderList.map((order) => (
                    <Link
                      key={order.id}
                      href={`/purchase-orders/${order.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {order.number} · {order.vendor.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Purchase order · placed {formatDate(order.orderDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular text-sm text-slate-700">
                          {formatCurrency(order.total)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                    </Link>
                  ))}
                  {pendingPaymentList.map((payment) => (
                    <Link
                      key={payment.id}
                      href={`/payments/${payment.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {payment.number} · {payment.purchaseOrder.vendor.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Payment request · for {payment.purchaseOrder.number}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular text-sm text-slate-700">
                          {formatCurrency(payment.amount)}
                        </span>
                        <StatusBadge status={payment.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Recent purchase requests"
              description={
                isRequester ? "The latest requests you raised." : "Latest activity across the company."
              }
              action={
                <Link
                  href="/purchase-requests"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {recentRequests.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No requests yet"
                description="Start with a purchase request and it will move through approvals to stock."
                action={
                  user.role === "APPROVER" ? undefined : (
                    <Link
                      href="/purchase-requests/new"
                      className={buttonClasses("primary", "sm")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New request
                    </Link>
                  )
                }
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {recentRequests.map((request) => (
                  <Link
                    key={request.id}
                    href={`/purchase-requests/${request.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {request.purpose}
                      </p>
                      <p className="text-xs text-slate-500">
                        {request.number} · {request.requester.name} ·{" "}
                        {request.department}
                        {request.vendor ? ` · ${request.vendor.name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="tabular text-sm text-slate-700">
                        {formatCurrency(requestTotal(request.items))}
                      </span>
                      <StatusBadge status={request.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Spend"
              description="Payments settled over the last six months."
            />
            <CardBody>
              <div className="flex h-32 items-end justify-between gap-2">
                {months.map((month) => (
                  <div key={month.key} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md bg-indigo-500/85 transition-all"
                      style={{
                        height: `${Math.max((month.total / peak) * 100, month.total > 0 ? 6 : 2)}%`,
                      }}
                      title={`${month.label}: ${formatCurrency(month.total)}`}
                    />
                    <span className="text-[10px] text-slate-500">{month.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {months[5].total > 0
                  ? `${formatCurrency(months[5].total)} paid this month.`
                  : "No payments settled this month yet."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Low stock"
              description={
                lowStock.length === 0
                  ? "Everything is above its minimum."
                  : `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} at or below minimum.`
              }
              action={
                <Link
                  href="/inventory?stock=low"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Inventory
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {lowStock.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Stock levels look healthy"
                description="Products drop into this list when they reach their minimum level."
              />
            ) : (
              <CardBody className="space-y-3">
                {lowStock.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-500">{product.sku}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.stockQty === 0
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {product.stockQty === 0 ? (
                        <TriangleAlert className="h-3 w-3" />
                      ) : null}
                      {product.stockQty} / min {product.minStock}
                    </span>
                  </div>
                ))}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="How it flows" />
            <CardBody>
              <ol className="space-y-3 text-sm text-slate-600">
                {[
                  "Request products",
                  "Approve the request",
                  "Assign a vendor",
                  "Create the purchase order",
                  "Approve the order",
                  "Pay and receive goods",
                ].map((step, index) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              {isAdmin(user.role) ? (
                <Link
                  href="/approvals"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <Inbox className="h-3.5 w-3.5" />
                  See what needs a decision
                </Link>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
