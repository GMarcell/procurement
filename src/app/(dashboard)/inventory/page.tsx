import Link from "next/link";
import { ArrowDown, Boxes, PackageSearch, SlidersHorizontal, Warehouse } from "lucide-react";
import type { MovementType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

function stockState(stock: number, min: number) {
  if (stock === 0) return { label: "Out of stock", className: "bg-red-50 text-red-700" };
  if (stock <= min) return { label: "Low", className: "bg-amber-50 text-amber-700" };
  return { label: "In stock", className: "bg-emerald-50 text-emerald-700" };
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = param(params, "q")?.trim() ?? "";
  const category = param(params, "category") ?? "";
  const stock = param(params, "stock") ?? "";
  const movementType = param(params, "type") ?? "";

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [products, allProducts, movements] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({ where: { isActive: true } }),
    prisma.inventoryMovement.findMany({
      where: movementType ? { type: movementType as MovementType } : {},
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { product: true, createdBy: true },
    }),
  ]);

  const visibleProducts =
    stock === "low"
      ? products.filter((product) => product.stockQty <= product.minStock)
      : products;

  const lowCount = allProducts.filter(
    (product) => product.stockQty <= product.minStock && product.stockQty > 0,
  ).length;
  const outCount = allProducts.filter((product) => product.stockQty === 0).length;
  const stockValue = allProducts.reduce(
    (sum, product) => sum + product.stockQty * Number(product.unitPrice),
    0,
  );

  const kpis = [
    { label: "Active products", value: String(allProducts.length), icon: Boxes },
    { label: "Low stock", value: String(lowCount), icon: Warehouse },
    { label: "Out of stock", value: String(outCount), icon: PackageSearch },
    { label: "Stock value", value: formatCurrency(stockValue), icon: SlidersHorizontal },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Live stock levels and every movement in and out of the warehouse."
      />

      <FlashMessage notice={param(params, "notice")} error={param(params, "error")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="tabular mt-2 text-2xl font-semibold text-slate-900">
                {kpi.value}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Stock on hand"
              description={`${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"} shown`}
            />
            <div className="border-b border-slate-100 p-3">
              <form method="get" className="flex flex-wrap items-center gap-2">
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Search product or SKU"
                  className="min-w-48 flex-1"
                />
                <Select name="category" defaultValue={category} className="w-auto min-w-40">
                  <option value="">All categories</option>
                  {PRODUCT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                <Select name="stock" defaultValue={stock} className="w-auto min-w-36">
                  <option value="">All stock</option>
                  <option value="low">Low or out</option>
                </Select>
                <button type="submit" className={buttonClasses("outline", "md")}>
                  Filter
                </button>
                {q || category || stock ? (
                  <Link
                    href="/inventory"
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
            </div>

            {visibleProducts.length === 0 ? (
              <EmptyState
                icon={Warehouse}
                title="No stock matches"
                description="Clear the filters, or try another product name or SKU."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Product</TH>
                    <TH>Category</TH>
                    <TH className="text-right">On hand</TH>
                    <TH className="text-right">Min</TH>
                    <TH className="text-right">Value</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {visibleProducts.map((product) => {
                    const state = stockState(product.stockQty, product.minStock);
                    return (
                      <TR key={product.id}>
                        <TD>
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            {product.sku} · per {product.unit}
                          </p>
                        </TD>
                        <TD>
                          <Badge tone="slate">{product.category}</Badge>
                        </TD>
                        <TD className="tabular text-right">
                          <span className="font-medium text-slate-900">
                            {product.stockQty}
                          </span>
                          <span className="text-xs text-slate-400"> {product.unit}</span>
                        </TD>
                        <TD className="tabular text-right text-slate-600">
                          {product.minStock}
                        </TD>
                        <TD className="tabular text-right text-slate-700">
                          {formatCurrency(product.stockQty * Number(product.unitPrice))}
                        </TD>
                        <TD>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${state.className}`}
                          >
                            {state.label}
                          </span>
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
              title="Movement ledger"
              description="The last 30 stock movements, newest first."
              action={
                <form method="get" className="flex items-center gap-2">
                  <Select name="type" defaultValue={movementType} className="h-8 w-auto py-0 text-xs">
                    <option value="">All types</option>
                    <option value="IN">Stock in</option>
                    <option value="OUT">Stock out</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </Select>
                  <button type="submit" className={buttonClasses("outline", "sm")}>
                    Filter
                  </button>
                </form>
              }
            />
            {movements.length === 0 ? (
              <EmptyState
                icon={ArrowDown}
                title="No movements yet"
                description="Deliveries and stock adjustments will appear here."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Product</TH>
                    <TH>Type</TH>
                    <TH className="text-right">Qty</TH>
                    <TH>Reference</TH>
                    <TH>By</TH>
                  </TR>
                </THead>
                <TBody>
                  {movements.map((movement) => (
                    <TR key={movement.id}>
                      <TD className="whitespace-nowrap text-xs text-slate-500">
                        {formatDateTime(movement.createdAt)}
                      </TD>
                      <TD>
                        <p className="text-sm text-slate-900">{movement.product.name}</p>
                        <p className="text-xs text-slate-500">{movement.product.sku}</p>
                      </TD>
                      <TD>
                        <StatusBadge status={movement.type} />
                      </TD>
                      <TD className="tabular text-right font-medium text-slate-900">
                        {movement.type === "OUT" ? "−" : "+"}
                        {movement.quantity}
                      </TD>
                      <TD className="text-xs text-slate-600">
                        {movement.reference ?? "—"}
                        {movement.note ? (
                          <span className="block text-slate-400">{movement.note}</span>
                        ) : null}
                      </TD>
                      <TD className="text-xs text-slate-500">{movement.createdBy.name}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {isAdmin(user.role) ? (
            <InventoryAdjustForm
              products={allProducts.map((product) => ({
                id: product.id,
                name: product.name,
                sku: product.sku,
                unit: product.unit,
                stockQty: product.stockQty,
              }))}
            />
          ) : (
            <Card>
              <CardHeader title="Stock adjustments" />
              <CardBody>
                <p className="text-sm text-slate-500">
                  Only procurement admins can adjust stock. Ask an admin if a
                  count looks wrong.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="How stock changes" />
            <CardBody className="space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-900">Stock in</span> — recorded
                automatically when a delivery is received against a purchase order.
              </p>
              <p>
                <span className="font-medium text-slate-900">Stock out</span> — an
                admin writes off damaged or issued goods.
              </p>
              <p>
                <span className="font-medium text-slate-900">Adjustment</span> — an
                opening balance or count correction.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
