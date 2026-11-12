import Link from "next/link";
import { Package, Pencil, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { param, type SearchParams } from "@/lib/search-params";
import { formatCurrency } from "@/lib/format";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { FlashMessage } from "@/components/flash-message";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

function stockTone(stock: number, min: number) {
  if (stock === 0) return { label: "Out of stock", className: "bg-red-50 text-red-700" };
  if (stock <= min) return { label: "Low stock", className: "bg-amber-50 text-amber-700" };
  return { label: "In stock", className: "bg-emerald-50 text-emerald-700" };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = param(params, "q")?.trim() ?? "";
  const category = param(params, "category") ?? "";
  const stock = param(params, "stock") ?? "";

  const where: Prisma.ProductWhereInput = {
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const allProducts = await prisma.product.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const products =
    stock === "low"
      ? allProducts.filter((product) => product.stockQty <= product.minStock)
      : allProducts;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Catalogue of everything the company buys, with live stock levels."
        action={
          isAdmin(user.role) ? (
            <Link href="/products/new" className={buttonClasses("primary")}>
              <Plus className="h-4 w-4" />
              New product
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
              placeholder="Search by name, SKU, or category"
              className="pl-9"
            />
          </div>
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
            <Link href="/products" className="text-xs text-slate-500 hover:text-slate-800">
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products match"
            description="Try a different search, or add a product to the catalogue."
            action={
              isAdmin(user.role) ? (
                <Link href="/products/new" className={buttonClasses("primary", "sm")}>
                  <Plus className="h-3.5 w-3.5" />
                  New product
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH>Category</TH>
                <TH className="text-right">Unit price</TH>
                <TH className="text-right">On hand</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {products.map((product) => {
                const tone = stockTone(product.stockQty, product.minStock);
                return (
                  <TR key={product.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {product.sku} · per {product.unit}
                        {!product.isActive ? " · inactive" : ""}
                      </p>
                    </TD>
                    <TD>
                      <Badge tone="slate">{product.category}</Badge>
                    </TD>
                    <TD className="tabular text-right text-slate-700">
                      {formatCurrency(product.unitPrice)}
                    </TD>
                    <TD className="tabular text-right">
                      <span className="font-medium text-slate-900">{product.stockQty}</span>
                      <span className="text-xs text-slate-400"> / min {product.minStock}</span>
                    </TD>
                    <TD>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone.className}`}
                      >
                        {tone.label}
                      </span>
                    </TD>
                    <TD className="text-right">
                      {isAdmin(user.role) ? (
                        <Link
                          href={`/products/${product.id}/edit`}
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
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        {products.length} product{products.length === 1 ? "" : "s"} shown. Stock
        changes only through deliveries and inventory adjustments.
      </p>
    </div>
  );
}
