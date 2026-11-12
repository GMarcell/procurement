"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Warehouse,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  approverOnly?: boolean;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/approvals", label: "Approvals", icon: Inbox, approverOnly: true },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { href: "/purchase-requests", label: "Purchase requests", icon: ClipboardList },
      { href: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart },
      { href: "/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Warehouse",
    items: [{ href: "/inventory", label: "Inventory", icon: Warehouse }],
  },
  {
    label: "Master data",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/vendors", label: "Vendors", icon: Store },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleGroups(role: Role) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.approverOnly || role === "APPROVER" || role === "ADMIN",
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
        <Truck className="h-4.5 w-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-white">Procura</span>
        <span className="block text-[11px] text-slate-400">Procurement</span>
      </span>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-200">
      {initials(name)}
    </span>
  );
}

export function Sidebar({
  user,
  pendingCount,
}: {
  user: { name: string; role: Role };
  pendingCount: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 lg:flex">
      <div className="flex h-16 items-center border-b border-white/5 px-5">
        <Brand />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {visibleGroups(user.role).map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/approvals" && pendingCount > 0 ? (
                        <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          {pendingCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({
  user,
  pendingCount,
}: {
  user: { name: string; role: Role };
  pendingCount: number;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <Truck className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-900">Procura</span>
        </Link>
        <div className="flex items-center gap-2">
          <Avatar name={user.name} />
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {visibleGroups(user.role)
          .flatMap((group) => group.items)
          .map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {item.label}
                {item.href === "/approvals" && pendingCount > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px]",
                      active ? "bg-white/20" : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
      </nav>
    </header>
  );
}

export function FlowMark() {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <Boxes className="h-3.5 w-3.5" />
      Request → approve → order → receive
    </div>
  );
}
