"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "./pagination";

export function UrlPagination({ currentPage, totalItems, pageSize = 10, pageParameter = "page", itemLabel = "items", zeroBased = false }: {
  currentPage: number; totalItems: number; pageSize?: number; pageParameter?: string; itemLabel?: string; zeroBased?: boolean;
}) {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  function change(page: number) {
    const query = new URLSearchParams(searchParams.toString());
    query.set(pageParameter, String(zeroBased ? page - 1 : page));
    router.push(`${pathname}?${query}`, { scroll: false });
  }
  return <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={change} itemLabel={itemLabel} />;
}
