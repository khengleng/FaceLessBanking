export type PageRequest = {
  page: number;
  pageSize: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CursorRequest = {
  cursor?: string;
  limit: number;
};

export type CursorMeta = {
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
  limit: number;
};

export type PaginatedItems<TItem> = {
  items: TItem[];
};

export type PageEnvelope<TItem> = PaginatedItems<TItem> & {
  page: PageMeta;
};

export type CursorEnvelope<TItem> = PaginatedItems<TItem> & {
  cursor: CursorMeta;
};

export function buildPageMeta(input: {
  page: number;
  pageSize: number;
  totalItems: number;
}): PageMeta {
  const totalPages = input.pageSize > 0 ? Math.ceil(input.totalItems / input.pageSize) : 0;

  return {
    page: input.page,
    pageSize: input.pageSize,
    totalItems: input.totalItems,
    totalPages
  };
}
