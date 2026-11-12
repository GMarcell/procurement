import { CheckCircle2, TriangleAlert } from "lucide-react";

export function FlashMessage({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  if (!notice && !error) return null;

  if (error) {
    return (
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{notice}</span>
    </div>
  );
}
