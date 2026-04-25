import {
  BetterDialog,
  BetterDialogContent,
} from '@/components/ui/better-dialog'
import { GROQ_MODELS } from '@/constants/models'
import {
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  TimeScheduleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { format } from 'date-fns'
import { HistoryRecord } from './types.t'

type HistoryDetailsDialogProps = {
  open: boolean
  record: HistoryRecord
  onOpenChange: (open: boolean) => void
}

type TimelineStep = {
  key: string
  label: string
  start: number | string | null | undefined
  end: number | string | null | undefined
}

function toMs(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function getStepDuration(
  start: number | null,
  end: number | null
): number | null {
  if (start != null && end != null) {
    return end - start
  }
  return null
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return '-'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(1)
  return `${minutes}m ${seconds}s`
}

function formatTimestamp(value: number | string | null | undefined): string {
  const ms = toMs(value)
  if (ms == null) return '-'
  return format(new Date(ms), 'MMM d, h:mm:ss a')
}

function formatShortTime(value: number | string | null | undefined): string {
  const ms = toMs(value)
  if (ms == null) return '-'
  return format(new Date(ms), 'h:mm:ss a')
}

function formatText(value: string | null | undefined): string {
  if (value == null) return '-'
  const trimmed = value.trim()
  return trimmed.length > 0 ? value : '-'
}

function getStepState(start: number | null, end: number | null): string {
  if (start != null && end != null) return 'Completed'
  if (start != null) return 'Running'
  return 'Not started'
}

function getRecordStatus(record: HistoryRecord): string {
  if (record.transcription_error) return 'Failed'
  if (record.completed_at) return 'Completed'
  if (record.started_at) return 'In progress'
  return 'Pending'
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="relative">
      <div className="bg-border absolute top-2 bottom-2 left-[5px] w-px" />
      <div className="space-y-0">
        {steps.map((step) => {
          const start = toMs(step.start)
          const end = toMs(step.end)
          const duration = getStepDuration(start, end)
          const state = getStepState(start, end)

          return (
            <div key={step.key} className="relative flex gap-3 py-2">
              <div className="relative z-10 mt-1.5 flex shrink-0">
                {state === 'Completed' && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="text-muted-foreground size-3"
                  />
                )}
                {state === 'Running' && (
                  <HugeiconsIcon
                    icon={TimeScheduleIcon}
                    className="text-primary size-3 animate-pulse"
                  />
                )}
                {state === 'Not started' && (
                  <div className="border-muted-foreground/40 size-3 rounded-full border" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDuration(duration)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {formatShortTime(step.start)} – {formatShortTime(step.end)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HistoryDetailsDialogContent({ record }: { record: HistoryRecord }) {
  const timelineSteps: TimelineStep[] = [
    {
      key: 'recording',
      label: 'Recording',
      start: record.recording_started_at,
      end: record.recording_completed_at,
    },
    {
      key: 'resampling',
      label: 'Resampling',
      start: record.resampling_started_at,
      end: record.resampling_completed_at,
    },
    {
      key: 'transcription',
      label: 'Transcription',
      start: record.transcription_started_at,
      end: record.transcription_completed_at,
    },
    {
      key: 'injection',
      label: 'Injection',
      start: record.injection_started_at,
      end: record.injection_completed_at,
    },
    {
      key: 'overall',
      label: 'Overall',
      start: record.started_at,
      end: record.completed_at,
    },
  ]

  const transcriptionOutput = formatText(record.transcription_output)
  const transcriptionError = formatText(record.transcription_error)
  const recordStatus = getRecordStatus(record)
  const modelName =
    GROQ_MODELS.find((m) => m.id === record.transcription_model)?.name ??
    record.transcription_model

  return (
    <BetterDialogContent
      title="Transcription Details"
      description={<>Recorded at {formatTimestamp(record.completed_at)}</>}
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h4 className="text-sm font-medium">Transcription Output</h4>
            {transcriptionOutput === '-' && (
              <span className="text-muted-foreground text-xs">Empty</span>
            )}
          </div>
          {transcriptionError !== '-' ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
              <HugeiconsIcon
                icon={CancelCircleIcon}
                className="mt-0.5 size-4 shrink-0"
              />
              <span className="break-words">{transcriptionError}</span>
            </div>
          ) : (
            <div className="bg-muted/40 max-h-64 overflow-auto rounded-lg border px-3.5 py-3 text-sm break-words whitespace-pre-wrap">
              {transcriptionOutput}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <DetailField label="Status" value={recordStatus} />
          <DetailField label="Language" value={formatText(record.language)} />
          <DetailField
            label="Duration"
            value={formatDuration(
              getStepDuration(
                toMs(record.started_at),
                toMs(record.completed_at)
              )
            )}
          />
          <DetailField
            label="Started"
            value={formatTimestamp(record.started_at)}
          />
          <DetailField
            label="Completed"
            value={formatTimestamp(record.completed_at)}
          />
          <DetailField label="Model" value={formatText(modelName)} />
          <DetailField label="Input" value={formatText(record.input_audio)} />
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium">Timeline</h4>
          <Timeline steps={timelineSteps} />
        </div>
      </div>
    </BetterDialogContent>
  )
}

export function HistoryDetailsDialog({
  open,
  record,
  onOpenChange,
}: HistoryDetailsDialogProps) {
  return (
    <BetterDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:[--width:48rem]"
    >
      <HistoryDetailsDialogContent record={record} />
    </BetterDialog>
  )
}
