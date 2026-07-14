"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  className?: string
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  searchPlaceholder?: string
  searchFilter?: (row: T, query: string) => boolean
  pageSize?: number
  isLoading?: boolean
  emptyMessage?: string
  toolbar?: React.ReactNode
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  searchPlaceholder = "Search…",
  searchFilter,
  pageSize = 10,
  isLoading = false,
  emptyMessage = "No results.",
  toolbar,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("")
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !searchFilter) {
      return data
    }
    return data.filter((row) => searchFilter(row, q))
  }, [data, query, searchFilter])

  const sorted = useMemo(() => {
    if (!sortCol) {
      return filtered
    }
    const col = columns.find((c) => c.id === sortCol)
    if (!col?.sortValue) {
      return filtered
    }
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av < bv) {
        return sortDir === "asc" ? -1 : 1
      }
      if (av > bv) {
        return sortDir === "asc" ? 1 : -1
      }
      return 0
    })
    return copy
  }, [columns, filtered, sortCol, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  function toggleSort(id: string) {
    const col = columns.find((c) => c.id === id)
    if (!col?.sortValue) {
      return
    }
    if (sortCol === id) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setSortCol(id)
    setSortDir("asc")
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchFilter ? (
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder={searchPlaceholder}
            className="max-w-xs"
          />
        ) : null}
        {toolbar}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(col.className, col.sortValue && "cursor-pointer select-none")}
                  onClick={() => toggleSort(col.id)}
                >
                  {col.header}
                  {sortCol === col.id ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.id} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sorted.length > pageSize ? (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of{" "}
            {sorted.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="hover:text-foreground disabled:opacity-50"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="hover:text-foreground disabled:opacity-50"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
