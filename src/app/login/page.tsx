import { redirect } from "next/navigation";
import { CheckCircle2, ClipboardList, PackageCheck, ShoppingCart, Truck, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

const steps = [
  { icon: ClipboardList, label: "Request", detail: "Staff raise a purchase request" },
  { icon: CheckCircle2, label: "Approve", detail: "Managers approve with full context" },
  { icon: ShoppingCart, label: "Order", detail: "Procurement assigns a vendor and orders" },
  { icon: Wallet, label: "Pay", detail: "Payment requests are approved and settled" },
  { icon: PackageCheck, label: "Receive", detail: "Proof of delivery updates stock" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-stretch bg-slate-50">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 15% 10%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(600px circle at 85% 85%, rgba(139,92,246,0.25), transparent 55%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/40">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-white">Procura</p>
              <p className="text-xs text-slate-400">Procurement, end to end</p>
            </div>
          </div>

          <h2 className="mt-16 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">
            From a request to the warehouse shelf — without the spreadsheet.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            One clean trail for products, vendors, approvals, purchase orders,
            payments, deliveries, and inventory.
          </p>
        </div>

        <div className="relative space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-indigo-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-white">
                    {index + 1}. {step.label}
                  </span>
                  <span className="text-xs text-slate-400">{step.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="relative text-xs text-slate-500">
          Request → approve → assign vendor → PO → payment → delivery → stock
        </p>
      </section>

      <section className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <LoginForm />
      </section>
    </main>
  );
}
