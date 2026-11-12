import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDate } from "@/lib/format";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = param(params, "q")?.trim() ?? "";
  const status = param(params, "status") ?? "";

  const where: Prisma.PurchaseRequestWhereInput = {
    ...(user.role === "REQUESTER" ? { requesterId: user.id } : {}),
    ...(status ? { status: status as Prisma.EnumRequestStatusFilter["equals"] } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { purpose: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const requests = await prisma.purchaseRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: true,
      items: true,
      vendor: { select: { name: true } },
      orders: {
        select: { id: true, number: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const canCreate = user.role !== "APPROVER";

  return (
    <div>
      <PageHeader
        title="Purchase requests"
        description={
          user.role === "REQUESTER"
            ? "Your requests from submission to delivery."
            : "Everything the company has asked to buy."
        }
        action={
          canCreate ? (
            <Link href="/purchase-requests/new" className={buttonClasses("primary")}>
              <Plus className="h-4 w-4" />
              New request
            </Link>
          ) : null
        }
      />

      <FlashMessage notice={param(params, "notice")} error={param(params, "error")} />

      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search number, purpose, or department"
              className="pl-9"
            />
          </div>
          <Select name="status" defaultValue={status} className="w-auto min-w-44">
            <option value="">All statuses</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
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
              href="/purchase-requests"
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {requests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No purchase requests"
            description="When someone needs something, a request is the first step."
            action={
              canCreate ? (
                <Link
                  href="/purchase-requests/new"
                  className={buttonClasses("primary", "sm")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New request
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Request</TH>
                <TH>Requester</TH>
                <TH>Needed by</TH>
                <TH className="text-right">Estimate</TH>
                <TH>Status</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((request) => {
                const total = request.items.reduce(
                  (sum, item) => sum + item.quantity * Number(item.estimatedUnitPrice),
                  0,
                );
                return (
                  <TR key={request.id}>
                    <TD>
                      <Link
                        href={`/purchase-requests/${request.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {request.number}
                      </Link>
                      <p className="max-w-72 truncate text-xs text-slate-500">
                        {request.purpose}
                      </p>
                    </TD>
                    <TD>
                      <p className="text-slate-700">{request.requester.name}</p>
                      <p className="text-xs text-slate-500">{request.department}</p>
                    </TD>
                    <TD className="text-slate-600">{formatDate(request.neededBy)}</TD>
                    <TD className="tabular text-right text-slate-700">
                      {formatCurrency(total)}
                    </TD>
                    <TD>
                      <StatusBadge status={request.status} />
                      {request.orders[0] ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {request.orders[0].number}
                        </p>
                      ) : null}
                    </TD>
                    <TD className="text-xs text-slate-500">
                      {formatDate(request.createdAt)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        {requests.length} request{requests.length === 1 ? "" : "s"} shown.
      </p>
    </div>
  );
}
