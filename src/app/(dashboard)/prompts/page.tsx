import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { CheckIcon, CopyIcon, SaveIcon, Undo2Icon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { gradeLabel, positiveIntParam } from '@/features/exams/ExamHelpers'
import { MetaRow } from '@/features/exams/StatTiles'
import {
  brokenAnswerObjects,
  isCachedPromptCode,
  knownPromptCode,
  missingPromptKeys,
  promptsQueryOptions,
  requiredKeysOf,
  storePrompt,
  updatePrompt,
} from '@/features/prompts/PromptsApi'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import type { Prompt } from '@/types/Prompt'
import { cn, formatServerTime } from '@/utils/Helpers'

/** Every LLM system prompt: pick a kind, then its grade / language row; read, copy, rewrite. */
export default function PromptsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const list = useQuery(promptsQueryOptions())
  // Unsaved text per prompt_id, kept while switching tabs; a row without an entry shows the saved text.
  const [drafts, setDrafts] = useState<Partial<Record<number, string>>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const save = useMutation({
    mutationFn: ({ promptId, text }: { promptId: number; text: string }) => updatePrompt(promptId, text),
    // Silent: the confirm dialog shows the error itself.
    meta: { silentError: true },
    onSuccess: (saved) => {
      storePrompt(queryClient, saved)
      clearDraft(saved.prompt_id)
      setConfirmOpen(false)
      toast.success(t('prompts.saved', { name: promptName(t, saved), version: saved.prompt_version }))
    },
  })

  function clearDraft(promptId: number) {
    setDrafts((current) => {
      const next = { ...current }
      delete next[promptId]
      return next
    })
  }

  const prompts = list.data
  const isDirty = (row: Prompt) => {
    const draft = drafts[row.prompt_id]
    return draft !== undefined && draft !== row.system_prompt
  }

  // An unknown or missing ?prompt= falls back to the first row.
  const requestedId = positiveIntParam(params.get('prompt'))
  const prompt = prompts?.find((row) => row.prompt_id === requestedId) ?? prompts?.[0]
  const codes = [...new Set(prompts?.map((row) => row.prompt_code))]
  const siblings = prompts?.filter((row) => row.prompt_code === prompt?.prompt_code) ?? []

  const text = prompt ? (drafts[prompt.prompt_id] ?? prompt.system_prompt) : ''
  const dirty = prompt ? isDirty(prompt) : false
  const keys = requiredKeysOf(prompt?.prompt_code ?? '')
  const missing = missingPromptKeys(text, keys)
  // The answer-object check only means something for prompts whose output has answers.
  const broken = keys.includes('"label"') ? brokenAnswerObjects(text) : []
  const canSave = dirty && text.trim() !== '' && missing.length === 0 && broken.length === 0 && !save.isPending

  function open(row: Prompt) {
    setParams({ prompt: String(row.prompt_id) })
  }

  async function copySaved(row: Prompt) {
    try {
      await navigator.clipboard.writeText(row.system_prompt)
      toast.success(t('prompts.copied', { name: promptName(t, row) }))
    } catch {
      toast.error(t('prompts.copyFailed'))
    }
  }

  let content: ReactNode
  if (list.isError && !prompts) {
    content = (
      <LoadError
        title={t('prompts.loadFailed')}
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (!prompts) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-10 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-[50vh] rounded-2xl" />
      </div>
    )
  } else if (!prompt) {
    content = (
      <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">{t('prompts.empty')}</p>
    )
  } else {
    content = (
      <>
        <div className="flex flex-col gap-2">
          <SegmentTabs
            label={t('prompts.codesLabel')}
            items={codes.map((code) => {
              const rows = prompts.filter((row) => row.prompt_code === code)
              return {
                key: code,
                label: codeLabel(t, code),
                active: code === prompt.prompt_code,
                dirty: rows.some(isDirty),
                onSelect: () => open(rows[0]),
              }
            })}
          />
          {siblings.length > 1 && (
            <SegmentTabs
              label={t('prompts.scopesLabel')}
              items={siblings.map((row) => ({
                key: String(row.prompt_id),
                label: scopeLabel(t, row),
                hint: t('prompts.version', { version: row.prompt_version }),
                active: row.prompt_id === prompt.prompt_id,
                dirty: isDirty(row),
                onSelect: () => open(row),
              }))}
            />
          )}
        </div>

        <MetaRow
          items={[
            { label: t('prompts.meta.code'), value: <span className="font-mono text-[13px]">{prompt.prompt_code}</span> },
            { label: t('prompts.meta.scope'), value: scopeLabel(t, prompt) },
            {
              label: t('prompts.meta.version'),
              value: <span className="font-mono">{t('prompts.version', { version: prompt.prompt_version })}</span>,
            },
            { label: t('prompts.meta.edited'), value: formatServerTime(prompt.modify_dt, i18n.language) },
            {
              label: t('prompts.meta.editedBy'),
              value: prompt.modify_id
                ? t('prompts.uid', { uid: prompt.modify_id })
                : t(prompt.prompt_version > 1 ? 'prompts.apiKey' : 'prompts.seed'),
            },
            {
              label: t('prompts.meta.length'),
              value: t('prompts.lengthValue', { n: Array.from(prompt.system_prompt).length.toLocaleString(i18n.language) }),
            },
          ]}
        />

        <section className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="prompt-text">{t('prompts.editor', { name: promptName(t, prompt) })}</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void copySaved(prompt)}>
                <CopyIcon aria-hidden />
                {t('prompts.copy')}
              </Button>
              <Button variant="outline" size="sm" disabled={!dirty} onClick={() => clearDraft(prompt.prompt_id)}>
                <Undo2Icon aria-hidden />
                {t('prompts.revert')}
              </Button>
              <Button size="sm" disabled={!canSave} onClick={() => setConfirmOpen(true)}>
                <SaveIcon aria-hidden />
                {t('prompts.save')}
              </Button>
            </div>
          </div>
          {prompt.description && <p className="text-sm text-muted-foreground">{prompt.description}</p>}
          <Textarea
            id="prompt-text"
            value={text}
            spellCheck={false}
            aria-invalid={missing.length > 0 || broken.length > 0 ? true : undefined}
            aria-describedby={keys.length > 0 ? 'prompt-keys' : undefined}
            onChange={(event) => setDrafts((current) => ({ ...current, [prompt.prompt_id]: event.target.value }))}
            className="min-h-[60vh] font-mono text-[13px] leading-relaxed"
          />
          {keys.length > 0 && (
            <div id="prompt-keys" className="flex flex-col gap-2">
              <span className={cn('text-sm', missing.length > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                {missing.length > 0
                  ? t('prompts.keysMissing', { n: missing.length })
                  : t('prompts.keysOk', { n: keys.length })}
              </span>
              <ul aria-label={t('prompts.keysTitle')} className="flex flex-wrap gap-1.5">
                {keys.map((key) => {
                  const absent = missing.includes(key)
                  return (
                    <li key={key}>
                      <StatusPill tone={absent ? 'danger' : 'success'} className="font-mono">
                        {absent ? <XIcon aria-hidden /> : <CheckIcon aria-hidden />}
                        {key}
                        <span className="sr-only">{t(absent ? 'prompts.absent' : 'prompts.present')}</span>
                      </StatusPill>
                    </li>
                  )
                })}
              </ul>
              {broken.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-destructive">
                    {t('prompts.brokenAnswers', { n: broken.length })}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {broken.map((block, index) => (
                      <li key={index}>
                        <code className="rounded-md bg-destructive-surface px-1.5 py-0.5 font-mono text-xs text-destructive">
                          {block.replace(/\s+/g, ' ')}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <ConfirmActionDialog
          open={confirmOpen}
          onClose={() => {
            setConfirmOpen(false)
            save.reset()
          }}
          title={t('prompts.confirmTitle', { name: promptName(t, prompt) })}
          description={
            <>
              <p>{t('prompts.confirmOverwrite')}</p>
              <p>{t('prompts.confirmVersion', { from: prompt.prompt_version, to: prompt.prompt_version + 1 })}</p>
              {isCachedPromptCode(prompt.prompt_code) && <p>{t('prompts.confirmCache', { name: promptName(t, prompt) })}</p>}
            </>
          }
          confirmLabel={t('prompts.save')}
          pendingLabel={t('prompts.saving')}
          pending={save.isPending}
          error={save.error}
          onConfirm={() => save.mutate({ promptId: prompt.prompt_id, text })}
        />
      </>
    )
  }

  return (
    <>
      <TitleBar title={t('prompts.title')} description={t('prompts.description')} />
      {content}
    </>
  )
}

/** The kind's name; a code the catalog does not know shows as itself. */
function codeLabel(t: TFunction, code: string): string {
  const known = knownPromptCode(code)
  return known ? t(`prompts.codes.${known}`) : code
}

/** "Lớp 2", "Lớp 2 · VI", or "Chung" for a row that varies by neither grade nor language. */
function scopeLabel(t: TFunction, row: Prompt): string {
  const parts: string[] = []
  if (row.grade !== null) parts.push(gradeLabel(t, row.grade))
  if (row.language) parts.push(row.language.toUpperCase())
  return parts.length > 0 ? parts.join(' · ') : t('prompts.allScopes')
}

function promptName(t: TFunction, row: Prompt): string {
  return `${codeLabel(t, row.prompt_code)} — ${scopeLabel(t, row)}`
}

type SegmentTab = { key: string; label: string; hint?: string; active: boolean; dirty: boolean; onSelect: () => void }

/** A row of toggle buttons (same look as the sitting filters); a dot marks unsaved text. */
function SegmentTabs({ label, items }: { label: string; items: SegmentTab[] }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={label} className="flex w-max max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.active}
          onClick={item.onSelect}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
            item.active && 'bg-card text-primary shadow-sm',
          )}
        >
          {item.label}
          {item.hint && <span className="font-mono text-xs font-normal">{item.hint}</span>}
          {item.dirty && (
            <span className="size-2 rounded-full bg-warning">
              <span className="sr-only">{t('prompts.unsaved')}</span>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
