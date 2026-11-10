export default function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span className="text-gray-500">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← Previous
        </button>
        <button type="button" className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next →
        </button>
      </div>
    </nav>
  );
}
