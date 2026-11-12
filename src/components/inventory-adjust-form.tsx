"use client";

import { useActionState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { adjustStock } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { emptyActionState } from "@/lib/types";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stockQty: number;
};

export function InventoryAdjustForm({ products }: { products: ProductOption[] }) {
  const [state, formAction, pending] = useActionState(adjustStock, emptyActionState);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Adjust stock"
          description="Use for corrections, internal issues, or opening balances."
        />
        <CardBody className="space-y-4">
          <FormError message={state.error} />

          <div>
            <Label htmlFor="productId">Product</Label>
            <Select id="productId" name="productId" defaultValue="" required>
              <option value="" disabled>
                Select a product…
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {product.stockQty} {product.unit} on hand
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="direction">Movement</Label>
              <Select id="direction" name="direction" defaultValue="IN">
                <option value="IN">Add stock (in)</option>
                <option value="OUT">Remove stock (out)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="note">Reason</Label>
            <Textarea
              id="note"
              name="note"
              placeholder="e.g. Damaged units written off, or stock count correction."
              required
            />
            <FieldHint>Every adjustment is written to the movement ledger.</FieldHint>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SlidersHorizontal className="h-4 w-4" />
              )}
              Record adjustment
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
