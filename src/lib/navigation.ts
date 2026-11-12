import { redirect } from "next/navigation";

/** Redirect back to a page with a human-readable flash message. */
export function flash(
  path: string,
  kind: "notice" | "error",
  message: string,
): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}`);
}
