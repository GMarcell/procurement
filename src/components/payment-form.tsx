"use client";

import { useActionState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { createPaymentRequest } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { emptyActionState } from "@/lib/types";

export function PaymentForm({
  purchaseOrderId,
  orderNumber,
  total,
  dueDate,
}: {
  purchaseOrderId: string;
  orderNumber: string;
  total: number;
  dueDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPaymentRequest,
    emptyActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <FormError message={state.error} />

      <Card>
        <CardHeader
          title={`Payment for ${orderNumber}`}
          description="One payment request is raised per purchase order."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="payment-amount">Amount (USD)</Label>
            <Input
              id="payment-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={total}
              defaultValue={total.toFixed(2)}
              required
            />
            <FieldHint>Cannot exceed the order total of ${total.toFixed(2)}.</FieldHint>
          </div>
          <div>
            <Label htmlFor="payment-method">Payment method</Label>
            <Select id="payment-method" name="method" defaultValue="BANK_TRANSFER">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="payment-dueDate">Due date</Label>
            <Input
              id="payment-dueDate"
              name="dueDate"
              type="date"
              defaultValue={dueDate}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              name="notes"
              placeholder="Invoice number, bank details, or internal reference…"
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          Submit payment request
        </Button>
      </div>
    </form>
  );
}
