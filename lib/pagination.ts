export const TABLE_PAGE_SIZE = 10;
export function parsePage(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 ? number : 1;
}
export function paginate(totalItems: number, requestedPage: number, pageSize = TABLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return { page, totalPages, offset: (page - 1) * pageSize, end: Math.min(totalItems, page * pageSize) };
}
