import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronsUpDown, Search } from 'lucide-react'

export interface DataTableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  render: (row: T) => ReactNode
  searchValue?: (row: T) => string
}

interface DataTableProps<T> {
  label: string
  rows: T[]
  columns: DataTableColumn<T>[]
  pageSize?: number
  emptyTitle?: string
}

export default function DataTable<T>({ label, rows, columns, pageSize = 6, emptyTitle = 'No records found.' }: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const nextRows = normalizedQuery
      ? rows.filter(row => columns.some(column => {
          const value = column.searchValue?.(row)
          if (value) return value.toLowerCase().includes(normalizedQuery)
          const rendered = column.render(row)
          return typeof rendered === 'string' && rendered.toLowerCase().includes(normalizedQuery)
        }))
      : rows

    if (!sortKey) return nextRows
    const sortColumn = columns.find(column => column.key === sortKey)
    if (!sortColumn) return nextRows

    return [...nextRows].sort((a, b) => {
      const aValue = sortColumn.searchValue?.(a) ?? String(sortColumn.render(a))
      const bValue = sortColumn.searchValue?.(b) ?? String(sortColumn.render(b))
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    })
  }, [columns, query, rows, sortDirection, sortKey])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return
    if (sortKey === column.key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(column.key)
      setSortDirection('asc')
    }
  }

  return (
    <section className="table-panel" aria-label={label}>
      <div className="table-toolbar">
        <div>
          <h2>{label}</h2>
          <span>{filteredRows.length} records</span>
        </div>
        <label className="table-search">
          <Search size={15} strokeWidth={1.8} />
          <input
            value={query}
            onChange={event => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search"
          />
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key}>
                  <button
                    className="table-sort"
                    disabled={!column.sortable}
                    onClick={() => handleSort(column)}
                  >
                    {column.header}
                    {column.sortable && (
                      sortKey === column.key
                        ? <ChevronDown className={sortDirection === 'desc' ? 'sort-desc' : ''} size={14} />
                        : <ChevronsUpDown size={14} />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={index}>
                {columns.map(column => <td key={column.key}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 && <div className="empty-state">{emptyTitle}</div>}

      <div className="table-footer">
        <span>Page {safePage} of {pageCount}</span>
        <div className="pagination-controls">
          <button disabled={safePage === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button>
          <button disabled={safePage === pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next</button>
        </div>
      </div>
    </section>
  )
}

