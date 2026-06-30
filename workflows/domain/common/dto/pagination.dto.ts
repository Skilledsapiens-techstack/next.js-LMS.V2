
export class PaginationQueryDto {
  page = 1;
  limit = 25;
}

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function createPaginatedResponse<T>(items: T[], page: number, limit: number, total: number): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}
