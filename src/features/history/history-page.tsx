import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GROQ_MODELS } from '@/constants/models'
import { DeleteHistoryButton } from '@/features/history/delete-history-button'
import { useQuery } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import Database from '@tauri-apps/plugin-sql'
import { useMemo, useState } from 'react'
import { HistoryRow } from './history-row'
import { HISTORY_TABLE_COLUMNS } from './table-columns'
import { HistoryRecord } from './types.t'

const HISTORY_QUERY_KEY = ['history', 'history-records']

export function HistoryPage() {
  const {
    data: records = [],
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    refetchInterval: 1000,
    queryKey: HISTORY_QUERY_KEY,
    queryFn: async (): Promise<HistoryRecord[]> => {
      const db = Database.get('sqlite:woice.db')
      return db.select<HistoryRecord[]>(
        'SELECT * FROM history ORDER BY started_at DESC'
      )
    },
  })

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])

  const table = useReactTable({
    data: records,
    columns: HISTORY_TABLE_COLUMNS,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  })

  const models = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.transcription_model.trim())
            .filter((model) => model.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [records]
  )

  if (isLoading) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <div className="text-muted-foreground py-12 text-center">
          Loading history...
        </div>
      </>
    )
  }

  if (isError) {
    let errorMessage = 'Failed to load history.'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <div className="space-y-3 py-12 text-center">
          <p className="text-destructive">{errorMessage}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </>
    )
  }

  if (records.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <div className="text-muted-foreground py-12 text-center">
          No history yet. Start recording to see your transcriptions here.
        </div>
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search transcription..."
          value={
            (table.getColumn('transcript')?.getFilterValue() as string) ?? ''
          }
          onChange={(event) =>
            table.getColumn('transcript')?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-xs"
        />
        <Select
          value={
            (table
              .getColumn('transcription_model')
              ?.getFilterValue() as string) ?? 'all'
          }
          onValueChange={(value) => {
            if (value === 'all') {
              table.getColumn('transcription_model')?.setFilterValue(undefined)
            }

            if (value !== 'all') {
              table.getColumn('transcription_model')?.setFilterValue(value)
            }
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((model) => {
              const displayName =
                GROQ_MODELS.find((m) => m.id === model)?.name ?? model

              return (
                <SelectItem key={model} value={model}>
                  {displayName}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <DeleteHistoryButton />
      </div>

      <div className="rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  let headerClassName =
                    'w-[150px] max-w-[150px] overflow-hidden py-3 pr-5 text-right'

                  if (header.column.id === 'transcript') {
                    headerClassName = 'w-auto py-3 pr-3 pl-5'
                  }

                  if (header.column.id === 'transcription_model') {
                    headerClassName =
                      'w-[110px] max-w-[110px] overflow-hidden py-3 pr-3 pl-4'
                  }

                  if (header.column.id === 'duration') {
                    headerClassName =
                      'w-[105px] max-w-[105px] overflow-hidden py-3 pr-3 pl-4'
                  }

                  if (header.isPlaceholder) {
                    return (
                      <TableHead key={header.id} className={headerClassName} />
                    )
                  }

                  return (
                    <TableHead key={header.id} className={headerClassName}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={HISTORY_TABLE_COLUMNS.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  No history records match your filters.
                </TableCell>
              </TableRow>
            )}

            {table.getRowModel().rows.map((row) => (
              <HistoryRow key={row.id} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm">
            {table.getFilteredRowModel().rows.length} results
          </p>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
              <SelectItem value="500">500 / page</SelectItem>
              <SelectItem value="1000">1000 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
