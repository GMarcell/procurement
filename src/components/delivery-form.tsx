"use client";

import { useActionState, useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { recordDelivery } from "@/app/actions/deliveries";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { DELIVERY_CONDITIONS, CONDITION_LABELS } from "@/lib/constants";
import { emptyActionState } from "@/lib/types";

type DeliveryLine = {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  ordered: number;
  received: number;
  remaining: number;
};

export function DeliveryForm({
  purchaseOrderId,
  orderNumber,
  lines,
  defaultDate,
  defaultReceiver,
}: {
  purchaseOrderId: string;
  orderNumber: string;
  lines: DeliveryLine[];
  defaultDate: string;
  defaultReceiver: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordDelivery,
    emptyActionState,
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((line) => [line.id, "0"])),
  );

  const payload = lines.map((line) => ({
    purchaseOrderItemId: line.id,
    quantity: Number(quantities[line.id]) || 0,
  }));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <FormError message={state.error} />

      <Card>
        <CardHeader
          title={`Receive goods for ${orderNumber}`}
          description="Received quantities are added to stock automatically."
        />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="delivery-receivedDate">Received date</Label>
              <Input
                id="delivery-receivedDate"
                name="receivedDate"
                type="date"
                defaultValue={defaultDate}
              />
            </div>
            <div>
              <Label htmlFor="delivery-receivedBy">Received by</Label>
              <Input
                id="delivery-receivedBy"
                name="receivedBy"
                defaultValue={defaultReceiver}
                placeholder="Warehouse receiver"
                required
              />
            </div>
            <div>
              <Label htmlFor="delivery-noteNo">Delivery note no.</Label>
              <Input
                id="delivery-noteNo"
                name="deliveryNoteNo"
                placeholder="e.g. DO-88231"
              />
            </div>
            <div>
              <Label htmlFor="delivery-condition">Condition</Label>
              <Select id="delivery-condition" name="condition" defaultValue="GOOD">
                {DELIVERY_CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {CONDITION_LABELS[condition]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="delivery-proofUrl">Proof link (optional)</Label>
              <Input
                id="delivery-proofUrl"
                name="proofUrl"
                placeholder="Link to a photo or signed delivery note"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Ordered</th>
                  <th className="px-4 py-2.5 font-medium">Received</th>
                  <th className="px-4 py-2.5 font-medium">Remaining</th>
                  <th className="px-4 py-2.5 font-medium">Receive now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{line.productName}</p>
                      <p className="text-xs text-slate-500">
                        {line.sku} · {line.unit}
                      </p>
                    </td>
                    <td className="tabular px-4 py-3 text-slate-700">{line.ordered}</td>
                    <td className="tabular px-4 py-3 text-slate-700">{line.received}</td>
                    <td className="tabular px-4 py-3 font-medium text-slate-900">
                      {line.remaining}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        max={line.remaining}
                        step="1"
                        value={quantities[line.id] ?? "0"}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [line.id]: event.target.value,
                          }))
                        }
                        className="h-9 w-24"
                        aria-label={`Quantity received for ${line.productName}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Label htmlFor="delivery-notes">Delivery notes (optional)</Label>
            <Textarea
              id="delivery-notes"
              name="notes"
              placeholder="Condition of packaging, shortages, damage details…"
            />
          </div>
          <FieldHint>
            You can record several deliveries. The order completes automatically
            once every line is fully received.
          </FieldHint>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PackageCheck className="h-4 w-4" />
          )}
          Record delivery
        </Button>
      </div>
    </form>
  );
}
