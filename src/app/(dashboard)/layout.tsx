import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { canApprove } from "@/lib/permissions";
import { MobileHeader, Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  let pendingCount = 0;
  if (canApprove(user.role)) {
    const [requests, orders, payments] = await Promise.all([
      prisma.purchaseRequest.count({ where: { status: "SUBMITTED" } }),
      prisma.purchaseOrder.count({ where: { status: "PENDING" } }),
      prisma.paymentRequest.count({ where: { status: "PENDING" } }),
    ]);
    pendingCount = requests + orders + payments;
  }

  const sidebarUser = { name: user.name, role: user.role };

  return (
    <div className="min-h-screen">
      <Sidebar user={sidebarUser} pendingCount={pendingCount} />
      <div className="lg:pl-64">
        <MobileHeader user={sidebarUser} pendingCount={pendingCount} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
