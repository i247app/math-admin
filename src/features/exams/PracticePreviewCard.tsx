import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusPill } from '@/components/StatusPill'
import type { PracticePreview } from '@/types/Exam'

/** What a PRACTICE round on this journey would drill if the app asked for one now. */
export function PracticePreviewCard({ preview, baseHref }: { preview: PracticePreview; baseHref: string }) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="font-semibold">{t('exams.journey.preview.title')}</h2>
        <StatusPill tone={preview.mode === 'RETRY_WEAK' ? 'warning' : 'success'}>
          {t(`exams.journey.preview.modes.${preview.mode}`)}
        </StatusPill>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 text-sm">
        <span className="text-xs text-muted-foreground">{t('exams.journey.preview.weak')}</span>
        {preview.weak_topics.length === 0 ? (
          <span className="text-muted-foreground">{t('exams.journey.preview.noWeak')}</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {preview.weak_topics.map(({ topic, wrong, answered }) => (
              <li key={topic} className="grid grid-cols-[1fr_8rem_3.5rem] items-center gap-3">
                <span className="truncate">{topic}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{ width: `${answered > 0 ? (wrong / answered) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs">
                  {wrong} / {answered}
                </span>
              </li>
            ))}
          </ul>
        )}
        {preview.strong_topics.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">{t('exams.journey.preview.strong')}</span>
            <div className="flex flex-wrap gap-1.5">
              {preview.strong_topics.map((topic) => (
                <StatusPill key={topic} tone="success">
                  {topic}
                </StatusPill>
              ))}
            </div>
          </>
        )}
        <Link to={baseHref} className="w-max text-xs font-semibold text-primary underline-offset-4 hover:underline">
          {t('exams.journey.preview.base', { id: preview.base_elink_id })}
        </Link>
      </div>
    </section>
  )
}
