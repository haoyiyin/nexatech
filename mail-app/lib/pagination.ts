export const INBOX_PAGE_SIZE = 20;

export function parsePageParam(pageParam: string | string[] | undefined): number {
  const rawValue = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = Number.parseInt(rawValue ?? "1", 10);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return parsedPage;
}

export function getTotalPages(totalItems: number, pageSize: number): number {
  if (totalItems <= 0) {
    return 1;
  }

  return Math.ceil(totalItems / pageSize);
}

export function clampPage(page: number, totalItems: number, pageSize: number): number {
  return Math.min(Math.max(page, 1), getTotalPages(totalItems, pageSize));
}

export function getPaginationRange(page: number, pageSize: number) {
  const start = (page - 1) * pageSize;

  return {
    from: start,
    to: start + pageSize - 1,
  };
}

export function getPaginationState(page: number, totalItems: number, pageSize: number) {
  const currentPage = clampPage(page, totalItems, pageSize);
  const totalPages = getTotalPages(totalItems, pageSize);

  return {
    currentPage,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}
