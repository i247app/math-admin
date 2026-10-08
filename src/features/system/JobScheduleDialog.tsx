import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/libs/ApiClient'
import type { JobInfo, JobSchedule } from '@/types/System'
import { MAX_EVERY_SECONDS, MIN_EVERY_SECONDS } from '@/types/System'
import { jobsQueryOptions, updateJobSchedule } from './SystemApi'

type Kind = JobSchedule['kind']
type EveryUnit = 'minutes' | 'hours' | 'days'

const KINDS: Kind[] = ['every', 'daily', 'weekly']
const UNIT_SECONDS: Record<EveryUnit, number> = { minutes: 60, hours: 3600, days: 86400 }
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'
// Go's time.Weekday names, as they appear in "weekly Monday 08:00 UTC".
const GO_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type FormState = {
  kind: Kind
  everyValue: string
  everyUnit: EveryUnit
  /** "HH:MM" from <input type="time">. */
  time: string
  /** "0" (Sunday) … "6". */
  weekday: string
  timezone: string
}

/** Seconds in a Go duration string ("1h30m0s", "15m0s", "500ms"). */
function parseGoDuration(value: string): number {
  const units: Record<string, number> = { h: 3600, m: 60, s: 1, ms: 1e-3, us: 1e-6, µs: 1e-6, ns: 1e-9 }
  let seconds = 0
  for (const [, amount, unit] of value.matchAll(/(\d+(?:\.\d+)?)(ms|us|µs|ns|h|m|s)/g)) {
    seconds += Number(amount) * units[unit]
  }
  return seconds
}

/** Pre-fills the form from the job's current schedule string (see JobInfo.schedule). */
function initialForm(schedule: string): FormState {
  const base: FormState = {
    kind: 'every',
    everyValue: '1',
    everyUnit: 'hours',
    time: '06:00',
    weekday: '1',
    timezone: DEFAULT_TIMEZONE,
  }

  const every = schedule.match(/^every (\S+)$/)
  if (every) {
    const seconds = parseGoDuration(every[1])
    const unit: EveryUnit = seconds % 86400 === 0 ? 'days' : seconds % 3600 === 0 ? 'hours' : 'minutes'
    return { ...base, everyUnit: unit, everyValue: String(Math.max(1, Math.round(seconds / UNIT_SECONDS[unit]))) }
  }
  const daily = schedule.match(/^daily (\d{2}:\d{2}) (\S+)$/)
  if (daily) return { ...base, kind: 'daily', time: daily[1], timezone: daily[2] }
  const weekly = schedule.match(/^weekly (\w+) (\d{2}:\d{2}) (\S+)$/)
  if (weekly) {
    const weekday = GO_WEEKDAYS.indexOf(weekly[1])
    return { ...base, kind: 'weekly', weekday: String(Math.max(0, weekday)), time: weekly[2], timezone: weekly[3] }
  }
  return base
}

/** Builds the request, or returns the translation key of what is wrong. */
function toSchedule(form: FormState): JobSchedule | { error: 'everyRange' | 'timeRequired' } {
  if (form.kind === 'every') {
    const seconds = Number(form.everyValue) * UNIT_SECONDS[form.everyUnit]
    if (!Number.isInteger(seconds) || seconds < MIN_EVERY_SECONDS || seconds > MAX_EVERY_SECONDS) {
      return { error: 'everyRange' }
    }
    return { kind: 'every', every_seconds: seconds }
  }
  const [hour, minute] = form.time.split(':').map(Number)
  if (!form.time || Number.isNaN(hour) || Number.isNaN(minute)) return { error: 'timeRequired' }
  const timezone = form.timezone.trim()
  return form.kind === 'daily'
    ? { kind: 'daily', hour, minute, timezone }
    : { kind: 'weekly', weekday: Number(form.weekday), hour, minute, timezone }
}

// Built once: ~400 IANA names for the timezone input's suggestions.
const TIMEZONES = Intl.supportedValuesOf('timeZone')

type JobScheduleDialogProps = {
  /** null = closed. */
  job: JobInfo | null
  onClose: () => void
}

/** Edit form for /jobs/schedule/update. The override lives in memory until the server restarts. */
export function JobScheduleDialog({ job, onClose }: JobScheduleDialogProps) {
  return (
    <Dialog open={job !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-2xl p-7 sm:max-w-[520px]">
        {job && <ScheduleForm key={job.name} job={job} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({ job, onClose }: { job: JobInfo; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => initialForm(job.schedule))
  const [validationError, setValidationError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (schedule: JobSchedule) => updateJobSchedule(job.name, schedule),
    meta: { silentError: true },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: jobsQueryOptions.queryKey })
      toast.success(t('system.jobs.schedule.saved', { name: job.name, schedule: res.job.schedule }))
      onClose()
    },
  })

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
    setValidationError(null)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const schedule = toSchedule(form)
    if ('error' in schedule) {
      setValidationError(t(`system.jobs.schedule.errors.${schedule.error}`))
      return
    }
    save.mutate(schedule)
  }

  const weekdayFormat = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', timeZone: 'UTC' })
  // 2023-01-01 was a Sunday, so day i of that week has weekday index i.
  const weekdays = GO_WEEKDAYS.map((_, index) => weekdayFormat.format(new Date(Date.UTC(2023, 0, 1 + index))))
  const error = validationError ?? (save.error ? getErrorMessage(save.error) : null)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <DialogHeader className="gap-2 text-left">
        <DialogTitle className="text-xl font-bold">{t('system.jobs.schedule.title')}</DialogTitle>
        <DialogDescription>
          <span className="font-mono text-foreground">{job.name}</span>
          {' · '}
          {t('system.jobs.schedule.current', { schedule: job.schedule })}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="schedule-kind">{t('system.jobs.schedule.kind')}</Label>
        <Select value={form.kind} onValueChange={(value) => update({ kind: value as Kind })}>
          <SelectTrigger id="schedule-kind" className="h-11 w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`system.jobs.schedule.kinds.${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.kind === 'every' ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-every">{t('system.jobs.schedule.interval')}</Label>
          <div className="flex gap-2">
            <Input
              id="schedule-every"
              type="number"
              min={1}
              inputMode="numeric"
              value={form.everyValue}
              onChange={(event) => update({ everyValue: event.target.value })}
              className="h-11 rounded-xl"
            />
            <Select value={form.everyUnit} onValueChange={(value) => update({ everyUnit: value as EveryUnit })}>
              <SelectTrigger aria-label={t('system.jobs.schedule.unit')} className="h-11 w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(UNIT_SECONDS) as EveryUnit[]).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(`system.jobs.schedule.units.${unit}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[13px] text-muted-foreground">{t('system.jobs.schedule.intervalHint')}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            {form.kind === 'weekly' && (
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="schedule-weekday">{t('system.jobs.schedule.weekday')}</Label>
                <Select value={form.weekday} onValueChange={(value) => update({ weekday: value })}>
                  <SelectTrigger id="schedule-weekday" className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekdays.map((label, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="schedule-time">{t('system.jobs.schedule.time')}</Label>
              <Input
                id="schedule-time"
                type="time"
                value={form.time}
                onChange={(event) => update({ time: event.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-timezone">{t('system.jobs.schedule.timezone')}</Label>
            <Input
              id="schedule-timezone"
              list="schedule-timezones"
              autoComplete="off"
              value={form.timezone}
              onChange={(event) => update({ timezone: event.target.value })}
              className="h-11 rounded-xl font-mono"
            />
            <datalist id="schedule-timezones">
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <p className="text-[13px] text-muted-foreground">{t('system.jobs.schedule.timezoneHint')}</p>
          </div>
        </>
      )}

      <p className="rounded-xl bg-warning-surface px-3.5 py-3 text-sm text-warning">
        {t('system.jobs.schedule.inMemoryNote', { schedule: job.default_schedule })}
      </p>

      {error && <FormAlert>{error}</FormAlert>}

      <DialogFooter className="gap-3">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('system.jobs.schedule.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
