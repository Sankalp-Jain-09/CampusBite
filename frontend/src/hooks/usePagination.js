import { useCallback, useState } from 'react';

export function usePagination(pageSize = 10) {
  const [page, setPage] = useState(1);
  const reset = useCallback(() => setPage(1), []);
  return { page, pageSize, setPage, reset };
}
