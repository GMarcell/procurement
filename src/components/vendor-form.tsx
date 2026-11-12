"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { saveVendor } from "@/app/actions/vendors";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { emptyActionState } from "@/lib/types";

export type VendorFormValues = {
  id?: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  isActive: boolean;
};

export function VendorForm({ vendor }: { vendor?: VendorFormValues }) {
  const [state, formAction, pending] = useActionState(
    saveVendor,
    emptyActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {vendor?.id ? <input type="hidden" name="id" value={vendor.id} /> : null}

      <FormError message={state.error} />

      <Card>
        <CardHeader
          title="Vendor details"
          description="Supplier information used on purchase orders."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="code">Vendor code</Label>
            <Input
              id="code"
              name="code"
              defaultValue={vendor?.code}
              placeholder="e.g. VND-TECH"
              required
            />
            <FieldHint>Unique short code for this supplier.</FieldHint>
          </div>
          <div>
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={vendor?.name}
              placeholder="e.g. Northline Technology Supply"
              required
            />
          </div>
          <div>
            <Label htmlFor="contactName">Contact person</Label>
            <Input
              id="contactName"
              name="contactName"
              defaultValue={vendor?.contactName}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={vendor?.email}
              placeholder="sales@vendor.com"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={vendor?.phone}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div>
            <Label htmlFor="paymentTerms">Payment terms</Label>
            <Input
              id="paymentTerms"
              name="paymentTerms"
              defaultValue={vendor?.paymentTerms ?? "NET 30"}
              placeholder="NET 30"
              required
            />
            <FieldHint>Agreed terms, e.g. NET 30 or Due on receipt.</FieldHint>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={vendor?.address}
              placeholder="Street, city, postal code"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={vendor?.isActive ?? true}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Active — available for vendor assignment
          </label>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/vendors" className={buttonClasses("outline")}>
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {vendor?.id ? "Save changes" : "Create vendor"}
        </Button>
      </div>
    </form>
  );
}
