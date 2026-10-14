import "server-only";

type PrismaLikeError = {
  code?: string;
  meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: string; fields?: string[] } } } };
};

/**
 * Unique cheklov buzilganmi va aynan shu ustunda. Driver adapter (`@prisma/adapter-pg`) bilan `meta.target`
 * bo'lmaydi — cheklov nomi ("Business_tin_key") `meta.driverAdapterError.cause.constraint` da keladi.
 */
export function isUniqueViolation(error: unknown, column: string): boolean {
  const e = error as PrismaLikeError;
  if (e?.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target) ? target.includes(column) : typeof target === "string" && target.includes(column)) return true;
  const constraint = e.meta?.driverAdapterError?.cause?.constraint;
  return Boolean(constraint?.fields?.includes(column) || constraint?.index?.endsWith(`_${column}_key`));
}
