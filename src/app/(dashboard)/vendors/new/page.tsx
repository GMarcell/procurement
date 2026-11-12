import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { VendorForm } from "@/components/vendor-form";

export default async function NewVendorPage() {
  const user = await requirePageUser();
  if (!isAdmin(user.role)) redirect("/vendors?error=Only+admins+can+add+vendors.");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New vendor"
        description="Register a supplier so it can receive purchase orders."
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
      <VendorForm />
    </div>
  );
}
