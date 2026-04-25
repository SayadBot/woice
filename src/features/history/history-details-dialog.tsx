import {
  BetterDialog,
  BetterDialogContent,
} from '@/components/ui/better-dialog'
import { LANGUAGES } from '@/constants/languages'
import { GROQ_MODELS } from '@/constants/models'
import {
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  FolderOpenIcon,
  PauseIcon,
  PlayIcon,
  TimeScheduleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { appDataDir, resolve } from '@tauri-apps/api/path'
import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { format } from 'date-fns'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  )
}

function AudioPlayer({ filename }: { filename: string }) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const toggle = useCallback(async () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        await audioRef.current.play()
        setPlaying(true)
      } else {
        audioRef.current.pause()
        setPlaying(false)
      }
      return
    }

    setLoading(true)
    try {
      const data = await readFile(`audio/${filename}`, {
        baseDir: BaseDirectory.AppData,
      })
      const blob = new Blob([data], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      urlRef.current = url

      const audio = new Audio(url)
      audio.onended = () => setPlaying(false)
      audio.onpause = () => setPlaying(false)
      audio.onplay = () => setPlaying(true)
      audioRef.current = audio
      await audio.play()
    } catch (e) {
      console.error('Failed to load audio:', e)
    } finally {
      setLoading(false)
    }
  }, [filename])

  const handleOpen = useCallback(async () => {
    try {
      const dir = await appDataDir()
      const path = await resolve(dir, 'audio', filename)
      await revealItemInDir(path)
    } catch (e) {
      console.error('Failed to reveal file:', e)
    }
  }, [filename])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [])

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5">
      <button
        onClick={toggle}
        disabled={loading}
        className="bg-muted hover:bg-muted/80 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors disabled:opacity-50"
      >
        <HugeiconsIcon
          icon={playing ? PauseIcon : PlayIcon}
          className="size-4"
        />
      </button>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
        {filename}
      </span>
      <button
        onClick={handleOpen}
        title="Open in file explorer"
        className="text-muted-foreground hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
      >
        <HugeiconsIcon icon={FolderOpenIcon} className="size-4" />
      </button>
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

  const lang = LANGUAGES.find((l) => l.code === record.language)

  return (
    <BetterDialogContent
      title="Transcription Details"
      description={<>Recorded at {formatTimestamp(record.completed_at)}</>}
    >
      <div className="space-y-5">
        {/* Row 1: Output */}
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

        {/* Row 2: Input Audio */}
        <div>
          <h4 className="mb-1.5 text-sm font-medium">Input Audio</h4>
          <AudioPlayer filename={record.input_audio} />
        </div>

        {/* Row 3: Data */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <DetailField label="Status" value={recordStatus} />
          <DetailField
            label="Language"
            value={
              <span className="inline-flex items-center gap-1.5">
                {lang?.country ? (
                  <span className={`fi fi-${lang.country} text-[0.8rem]`} />
                ) : null}
                <span>{formatText(record.language)}</span>
              </span>
            }
          />
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
        </div>

        {/* Row 4: Timeline */}
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
