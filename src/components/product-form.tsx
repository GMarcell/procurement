"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { saveProduct } from "@/app/actions/products";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PRODUCT_CATEGORIES, UNITS } from "@/lib/constants";
import { emptyActionState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export type ProductFormValues = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  stockQty: number;
  minStock: number;
  description: string;
  isActive: boolean;
};

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const [state, formAction, pending] = useActionState(
    saveProduct,
    emptyActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}

      <FormError message={state.error} />

      <Card>
        <CardHeader
          title="Product details"
          description="SKU and name identify the item everywhere in Procura."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku}
              placeholder="e.g. IT-LAP-001"
              required
            />
            <FieldHint>Unique code used on requests and orders.</FieldHint>
          </div>
          <div>
            <Label htmlFor="name">Product name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name}
              placeholder="e.g. 14-inch business laptop"
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              list="product-categories"
              defaultValue={product?.category}
              placeholder="IT Equipment"
              required
            />
            <datalist id="product-categories">
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="unit">Unit of measure</Label>
            <Select id="unit" name="unit" defaultValue={product?.unit ?? "pcs"}>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="unitPrice">Unit price (USD)</Label>
            <Input
              id="unitPrice"
              name="unitPrice"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={product ? product.unitPrice.toFixed(2) : ""}
              placeholder="0.00"
              required
            />
            <FieldHint>Used as the default estimate on new requests.</FieldHint>
          </div>
          <div>
            <Label htmlFor="minStock">Minimum stock</Label>
            <Input
              id="minStock"
              name="minStock"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.minStock ?? 0}
              required
            />
            <FieldHint>Triggers the low-stock warning on the dashboard.</FieldHint>
          </div>
          {!product?.id ? (
            <div>
              <Label htmlFor="stockQty">Opening stock</Label>
              <Input
                id="stockQty"
                name="stockQty"
                type="number"
                min="0"
                step="1"
                defaultValue={0}
              />
              <FieldHint>
                Starting quantity on hand. Later changes come from deliveries and
                adjustments.
              </FieldHint>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <p className="text-xs text-slate-500">Current stock</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {product.stockQty} {product.unit} ·{" "}
                {formatCurrency(product.stockQty * product.unitPrice)} value
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Use Inventory to receive goods or adjust stock.
              </p>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={product?.description}
              placeholder="Specifications, preferred brand, or notes for buyers."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product?.isActive ?? true}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Active — available for new requests and orders
          </label>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/products" className={buttonClasses("outline")}>
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {product?.id ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
