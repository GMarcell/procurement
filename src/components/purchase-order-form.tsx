"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, ShoppingCart } from "lucide-react";
import { createPurchaseOrder } from "@/app/actions/orders";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { emptyActionState } from "@/lib/types";

type OrderLine = {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  estimatedUnitPrice: number;
};

export function PurchaseOrderForm({
  requestId,
  requestNumber,
  vendorName,
  vendorTerms,
  items,
}: {
  requestId: string;
  requestNumber: string;
  vendorName: string;
  vendorTerms: string;
  items: OrderLine[];
}) {
  const [state, formAction, pending] = useActionState(
    createPurchaseOrder,
    emptyActionState,
  );
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      items.map((item) => [item.productId, item.estimatedUnitPrice.toFixed(2)]),
    ),
  );

  const pricePayload = items.map((item) => ({
    productId: item.productId,
    unitPrice: Number(prices[item.productId]) || 0,
  }));

  const total = items.reduce(
    (sum, item) => sum + item.quantity * (Number(prices[item.productId]) || 0),
    0,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="prices" value={JSON.stringify(pricePayload)} />

      <FormError message={state.error} />

      <Card>
        <CardHeader
          title={`Order against ${requestNumber}`}
          description={`Vendor: ${vendorName} · ${vendorTerms}`}
        />
        <CardBody className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Quantity</th>
                  <th className="px-4 py-2.5 font-medium">Unit price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">
                        {item.sku} · {item.unit}
                      </p>
                    </td>
                    <td className="tabular px-4 py-3 text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={prices[item.productId] ?? ""}
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [item.productId]: event.target.value,
                          }))
                        }
                        className="h-9 w-32"
                        aria-label={`Unit price for ${item.productName}`}
                      />
                    </td>
                    <td className="tabular px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(
                        item.quantity * (Number(prices[item.productId]) || 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Order total
                  </td>
                  <td className="tabular px-4 py-3 text-right text-base font-semibold text-slate-900">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="expectedDate">Expected delivery (optional)</Label>
              <Input id="expectedDate" name="expectedDate" type="date" />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                name="notes"
                placeholder="Delivery address, reference, terms…"
              />
            </div>
          </div>
          <FieldHint>
            Quantities come from the approved request. Confirm the vendor&apos;s
            unit prices before submitting.
          </FieldHint>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/purchase-requests/${requestId}`}
          className={buttonClasses("outline")}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          Create purchase order
        </Button>
      </div>
    </form>
  );
}
