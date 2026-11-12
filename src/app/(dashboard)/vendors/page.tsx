import Link from "next/link";
import { Pencil, Plus, Search, Store } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = param(params, "q")?.trim() ?? "";
  const status = param(params, "status") ?? "";

  const where: Prisma.VendorWhereInput = {
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Approved suppliers and the terms agreed with them."
        action={
          isAdmin(user.role) ? (
            <Link href="/vendors/new" className={buttonClasses("primary")}>
              <Plus className="h-4 w-4" />
              New vendor
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
              placeholder="Search by vendor, code, or contact"
              className="pl-9"
            />
          </div>
          <Select name="status" defaultValue={status} className="w-auto min-w-36">
            <option value="">All vendors</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </Select>
          <button type="submit" className={buttonClasses("outline")}>
            Filter
          </button>
          {q || status ? (
            <Link href="/vendors" className="text-xs text-slate-500 hover:text-slate-800">
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {vendors.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No vendors found"
            description="Add a supplier before assigning one to a purchase request."
            action={
              isAdmin(user.role) ? (
                <Link href="/vendors/new" className={buttonClasses("primary", "sm")}>
                  <Plus className="h-3.5 w-3.5" />
                  New vendor
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Vendor</TH>
                <TH>Contact</TH>
                <TH>Payment terms</TH>
                <TH className="text-right">Orders</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {vendors.map((vendor) => (
                <TR key={vendor.id}>
                  <TD>
                    <p className="font-medium text-slate-900">{vendor.name}</p>
                    <p className="text-xs text-slate-500">{vendor.code}</p>
                  </TD>
                  <TD>
                    <p className="text-slate-700">{vendor.contactName ?? "—"}</p>
                    <p className="text-xs text-slate-500">
                      {vendor.email ?? vendor.phone ?? "No contact details"}
                    </p>
                  </TD>
                  <TD>
                    <Badge tone="slate">{vendor.paymentTerms}</Badge>
                  </TD>
                  <TD className="tabular text-right text-slate-700">
                    {vendor._count.orders}
                  </TD>
                  <TD>
                    <Badge tone={vendor.isActive ? "emerald" : "slate"}>
                      {vendor.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    {isAdmin(user.role) ? (
                      <Link
                        href={`/vendors/${vendor.id}/edit`}
                        className={buttonClasses("ghost", "sm")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
