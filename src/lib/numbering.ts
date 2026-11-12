import type { Prisma } from "@prisma/client";

export type DocumentPrefix = "PR" | "PO" | "PAY";

/**
 * Atomically increment a per-type, per-year counter and format the next
 * document number, e.g. PR-2026-0001.
 *
 * Must be called inside a transaction so the counter and the document are
 * committed together.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: DocumentPrefix,
) {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;

  const sequence = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `${key}-${String(sequence.value).padStart(4, "0")}`;
}
