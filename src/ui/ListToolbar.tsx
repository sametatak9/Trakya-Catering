import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

/** Liste üstü araç çubuğu: arama + filtreler + sağda eylemler (Rapor, Ekle…) */
export function ListToolbar({ search, onSearch, placeholder = 'Ara…', filters, actions }: {
  search?: string; onSearch?: (v: string) => void; placeholder?: string; filters?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 p-4 border-b border-line">
      {onSearch && (
        <div className="relative lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="tc-input pl-9 pr-8" placeholder={placeholder} value={search ?? ''} onChange={(e) => onSearch(e.target.value)} />
          {search && (
            <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink" aria-label="Aramayı temizle">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {filters && <div className="flex flex-wrap items-center gap-2 flex-1">{filters}</div>}
      {actions && <div className="flex flex-wrap gap-2 lg:ml-auto">{actions}</div>}
    </div>
  );
}

/** Türkçe büyük/küçük harf duyarsız arama */
export function matches(q: string, ...fields: Array<string | null | undefined>): boolean {
  const n = q.trim().toLocaleLowerCase('tr');
  if (!n) return true;
  return fields.some((f) => (f ?? '').toLocaleLowerCase('tr').includes(n));
}
