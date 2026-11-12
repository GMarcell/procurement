import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { VendorForm } from "@/components/vendor-form";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  if (!isAdmin(user.role)) redirect("/vendors?error=Only+admins+can+edit+vendors.");

  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${vendor.name}`}
        description="Update supplier contact details and payment terms."
        back={
          <Link
            href="/vendors"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to vendors
          </Link>
        }
      />
      <VendorForm
        vendor={{
          id: vendor.id,
          code: vendor.code,
          name: vendor.name,
          contactName: vendor.contactName ?? "",
          email: vendor.email ?? "",
          phone: vendor.phone ?? "",
          address: vendor.address ?? "",
          paymentTerms: vendor.paymentTerms,
          isActive: vendor.isActive,
        }}
      />
    </div>
  );
}
