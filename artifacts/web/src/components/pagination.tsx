import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function usePagination<T>(items: T[] | undefined, pageSize = 10) {
  const [page, setPage] = React.useState(1);
  const total = items?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  React.useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);
  const start = (page - 1) * pageSize;
  const pageItems = items?.slice(start, start + pageSize) ?? [];
  return { page, setPage, pageCount, total, pageItems, pageSize };
}

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div
      data-testid="pagination"
      className="flex items-center justify-between gap-3 py-2 text-sm text-muted-foreground"
    >
      <span>
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        <span className="font-medium text-foreground">{pageCount}</span>
        <span className="ml-2 hidden sm:inline">({total} total)</span>
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          data-testid="pagination-prev"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          data-testid="pagination-next"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
