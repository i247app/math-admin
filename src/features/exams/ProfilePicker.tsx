import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/FormAlert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { profilesListQueryOptions } from '@/features/profiles/ProfilesApi'
import { RoleBadge } from '@/features/users/UserBadges'
import { getErrorMessage } from '@/libs/ApiClient'
import { cn, initialsOf } from '@/utils/Helpers'
import { positiveIntParam } from './ExamHelpers'

type Mode = 'search' | 'id'
const RESULT_LIMIT = 8

type ProfilePickerProps = {
  onPick: (profileId: number) => void
  /** Why the profile in the URL could not be loaded, shown under the form. */
  error?: string
}

/** Finds a profile by name/code (/profiles/list search) or takes a profile id as typed. */
export function ProfilePicker({ onPick, error }: ProfilePickerProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('search')
  const [text, setText] = useState('')
  // The search that was submitted; null until the first one.
  const [search, setSearch] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)

  const results = useQuery({
    ...profilesListQueryOptions({ page: 1, size: RESULT_LIMIT, search: search ?? '' }),
    enabled: search !== null,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = text.trim()
    if (mode === 'id') {
      const id = positiveIntParam(value)
      if (!id) {
        setInputError(t('exams.picker.invalidId'))
        return
      }
      setInputError(null)
      onPick(id)
      return
    }
    if (!value) {
      setInputError(t('exams.picker.required'))
      return
    }
    setInputError(null)
    setSearch(value)
  }

  const profiles = results.data?.profiles
  const message = inputError ?? error

  return (
    <section aria-label={t('exams.picker.label')} className="overflow-hidden rounded-2xl border bg-card">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode)
              setInputError(null)
              setSearch(null)
            }}
          >
            <SelectTrigger aria-label={t('exams.picker.mode')} className="h-11 w-52 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="search">{t('exams.picker.bySearch')}</SelectItem>
              <SelectItem value="id">{t('exams.picker.byId')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type={mode === 'search' ? 'search' : 'text'}
            inputMode={mode === 'id' ? 'numeric' : undefined}
            autoComplete="off"
            maxLength={128}
            aria-label={t(mode === 'search' ? 'exams.picker.searchPlaceholder' : 'exams.picker.idPlaceholder')}
            placeholder={t(mode === 'search' ? 'exams.picker.searchPlaceholder' : 'exams.picker.idPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={inputError !== null}
            className={cn('h-11 w-80 rounded-xl', mode === 'id' && 'font-mono')}
          />
          <Button type="submit" className="h-11 rounded-xl px-4.5">
            <SearchIcon aria-hidden />
            {t('exams.picker.submit')}
          </Button>
        </div>
        {message && <FormAlert>{message}</FormAlert>}
      </form>

      {mode === 'search' && search !== null && (
        <div className="border-t" aria-live="polite" aria-busy={results.isFetching}>
          {results.isError ? (
            <div className="px-5 py-4">
              <FormAlert>{getErrorMessage(results.error)}</FormAlert>
            </div>
          ) : !profiles ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t('exams.picker.searching')}</p>
          ) : profiles.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t('exams.picker.noMatch', { search })}</p>
          ) : (
            <div className={cn('transition-opacity', results.isPlaceholderData && 'opacity-60')}>
              <p className="px-5 pt-3 pb-1 text-xs text-muted-foreground">
                {t('exams.picker.matches', { count: results.data?.pagination.total_count ?? 0, search })}
              </p>
              <ul>
                {profiles.map((profile) => {
                  const name = profile.name || profile.profile_code
                  const details = [
                    profile.profile_code,
                    t('exams.picker.profileId', { id: profile.profile_id }),
                    t('exams.picker.account', { uid: profile.uid }),
                    profile.grade?.label ?? t('exams.picker.noGrade'),
                    profile.school?.name,
                  ].filter(Boolean)
                  return (
                    <li key={profile.profile_id} className="flex items-center gap-3 border-t px-5 py-2.5 first:border-t-0">
                      <Avatar className="size-9">
                        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                        <AvatarFallback className="bg-secondary text-[13px] font-bold text-primary">
                          {initialsOf(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="flex items-center gap-2 font-semibold">
                          <span className="truncate">{name}</span>
                          <RoleBadge role={profile.role} />
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{details.join(' · ')}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('exams.picker.pickName', { name })}
                        onClick={() => onPick(profile.profile_id)}
                      >
                        {t('exams.picker.pick')}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
