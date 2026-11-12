import type { Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  ASSIGNED: "Vendor assigned",
  ORDERED: "Ordered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  PENDING: "Pending approval",
  PARTIALLY_RECEIVED: "Partially received",
  COMPLETED: "Completed",
  PAID: "Paid",
  GOOD: "Good",
  DAMAGED: "Damaged",
  PARTIAL: "Partial",
  IN: "Stock in",
  OUT: "Stock out",
  ADJUSTMENT: "Adjustment",
};

const tones: Record<string, Tone> = {
  SUBMITTED: "amber",
  APPROVED: "emerald",
  ASSIGNED: "indigo",
  ORDERED: "blue",
  REJECTED: "red",
  CANCELLED: "slate",
  PENDING: "amber",
  PARTIALLY_RECEIVED: "orange",
  COMPLETED: "emerald",
  PAID: "emerald",
  GOOD: "emerald",
  DAMAGED: "red",
  PARTIAL: "amber",
  IN: "emerald",
  OUT: "red",
  ADJUSTMENT: "amber",
};

const dots: Record<Tone, string> = {
  slate: "bg-slate-400",
  indigo: "bg-indigo-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
};

const surfaces: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-50 text-indigo-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = tones[status] ?? "slate";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        surfaces[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />
      {labels[status] ?? status}
    </span>
  );
}
