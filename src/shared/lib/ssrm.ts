// Server-Side Row Model (SSRM) pagination helper for OpenBB grid widgets.

interface SortEntry {
  colId: string;
  sort: 'asc' | 'desc';
}

interface FilterEntry {
  type: string;
  filter: string | number;
  filterTo?: string | number;
}

export interface SSRMParams {
  startRow?: number;
  endRow?: number;
  sortModel?: string;
  filterModel?: string;
}

export interface SSRMResult<T> {
  rows: T[];
  lastRow: number;
}

function matchFilter(value: unknown, entry: FilterEntry): boolean {
  const { type, filter, filterTo } = entry;
  switch (type) {
    case 'contains':
      return String(value).toLowerCase().includes(String(filter).toLowerCase());
    case 'equals':
      // biome-ignore lint: loose equality intentional for string/number coercion
      return value == filter;
    case 'greaterThan':
      return Number(value) > Number(filter);
    case 'lessThan':
      return Number(value) < Number(filter);
    case 'inRange':
      return Number(value) >= Number(filter) && Number(value) <= Number(filterTo ?? filter);
    default:
      return true;
  }
}

export function applySSRM<T extends Record<string, unknown>>(
  rows: T[],
  opts: SSRMParams,
): SSRMResult<T> {
  let result = [...rows];

  // 1. Filter
  if (opts.filterModel) {
    let filters: Record<string, FilterEntry>;
    try { filters = JSON.parse(opts.filterModel); } catch { filters = {}; }
    for (const [col, entry] of Object.entries(filters)) {
      result = result.filter(row => matchFilter(row[col], entry));
    }
  }

  const lastRow = result.length;

  // 2. Sort
  if (opts.sortModel) {
    let sorts: SortEntry[];
    try { sorts = JSON.parse(opts.sortModel); } catch { sorts = []; }
    result.sort((a, b) => {
      for (const { colId, sort } of sorts) {
        const av = a[colId];
        const bv = b[colId];
        if (av === bv) continue;
        const cmp = av == null ? -1 : bv == null ? 1
          : typeof av === 'string' ? av.localeCompare(String(bv))
          : Number(av) - Number(bv);
        return sort === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // 3. Paginate
  const start = opts.startRow ?? 0;
  const end = opts.endRow ?? result.length;
  result = result.slice(start, end);

  return { rows: result, lastRow };
}
