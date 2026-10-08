import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/Helpers'

/** ai_review_short / ai_review_long of a journey; absent until the app asked for a review. */
export function AiReviewCard({ short, long }: { short?: string; long?: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="flex flex-col rounded-2xl border bg-card">
      <h2 className="border-b px-5 py-3.5 font-semibold">{t('exams.journey.review.title')}</h2>
      <div className="flex flex-col gap-2 px-5 py-4 leading-relaxed">
        {!short && !long ? (
          <p className="text-muted-foreground">{t('exams.journey.review.empty')}</p>
        ) : (
          <>
            {short && <p className="font-semibold">{short}</p>}
            {long && (
              <>
                <p className={cn('whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-3')}>{long}</p>
                <Button
                  variant="link"
                  className="h-auto self-start p-0"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {t(expanded ? 'exams.journey.review.showLess' : 'exams.journey.review.showMore')}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
