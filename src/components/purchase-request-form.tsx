"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { createPurchaseRequest } from "@/app/actions/requests";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { DEPARTMENTS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { emptyActionState } from "@/lib/types";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
};

type Line = {
  key: number;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export function PurchaseRequestForm({
  products,
  department,
}: {
  products: ProductOption[];
  department: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPurchaseRequest,
    emptyActionState,
  );
  const nextKey = useRef(2);
  const [lines, setLines] = useState<Line[]>([
    { key: 1, productId: "", quantity: "1", unitPrice: "" },
  ]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function chooseProduct(key: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(key, {
      productId,
      unitPrice: product ? product.unitPrice.toFixed(2) : "",
    });
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { key: nextKey.current++, productId: "", quantity: "1", unitPrice: "" },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  const validLines = lines.filter(
    (line) => line.productId && Number(line.quantity) > 0,
  );
  const estimate = validLines.reduce(
    (sum, line) => sum + Number(line.quantity) * (Number(line.unitPrice) || 0),
    0,
  );

  const items = validLines.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity),
    estimatedUnitPrice: Number(line.unitPrice) || 0,
  }));

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <FormError message={state.error} />

      <Card>
        <CardHeader
          title="Request details"
          description="Tell the approver what is needed and why."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="department">Department</Label>
            <Select id="department" name="department" defaultValue={department}>
              {DEPARTMENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="neededBy">Needed by (optional)</Label>
            <Input id="neededBy" name="neededBy" type="date" />
            <FieldHint>When the department would like the items.</FieldHint>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              name="purpose"
              placeholder="e.g. Replace end-of-life laptops for the design team."
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes for procurement (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Preferred brand, delivery instructions, budget reference…"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Items"
          description="Choose products and quantities. Prices are estimates until the PO is created."
          action={
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              No items yet. Add the first product.
            </p>
          ) : null}

          {lines.map((line) => {
            const product = products.find((item) => item.id === line.productId);
            const lineTotal =
              Number(line.quantity) * (Number(line.unitPrice) || 0);

            return (
              <div
                key={line.key}
                className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-6">
                  <Label htmlFor={`product-${line.key}`}>Product</Label>
                  <Select
                    id={`product-${line.key}`}
                    value={line.productId}
                    onChange={(event) =>
                      chooseProduct(line.key, event.target.value)
                    }
                  >
                    <option value="">Select a product…</option>
                    {products.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`qty-${line.key}`}>Quantity</Label>
                  <Input
                    id={`qty-${line.key}`}
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: event.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`price-${line.key}`}>Unit price</Label>
                  <Input
                    id={`price-${line.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) =>
                      updateLine(line.key, { unitPrice: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Line total</p>
                    <p className="tabular text-sm font-medium text-slate-900">
                      {formatCurrency(lineTotal)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-40"
                    title="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {product ? (
                  <p className="text-[11px] text-slate-500 sm:col-span-12">
                    {product.name} · measured in {product.unit}
                  </p>
                ) : null}
              </div>
            );
          })}

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Estimated total</p>
              <p className="tabular text-xl font-semibold text-slate-900">
                {formatCurrency(estimate)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/purchase-requests" className={buttonClasses("outline")}>
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit request
        </Button>
      </div>
    </form>
  );
}
