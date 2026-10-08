import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormAlert'
import { FormField } from '@/components/FormField'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { curriculumListQueryOptions } from '@/features/curriculum/CurriculumApi'
import { getErrorMessage } from '@/libs/ApiClient'
import type { CurriculumKind } from '@/types/Curriculum'
import type { Profile, ProfileFieldsInput, ProfileRole } from '@/types/Profile'
import { PROFILE_ROLES } from '@/types/Profile'
import { initialsOf, isValidEmail, parseServerTime } from '@/utils/Helpers'
import type { SchoolChange } from './ProfilesApi'
import { AVATAR_MAX_BYTES, createProfile, PROFILE_LIMITS, profilesQueryKey, updateProfile } from './ProfilesApi'

type ProfileFormSheetProps = {
  /** null = closed, 'new' = create, a profile = edit it. */
  target: Profile | 'new' | null
  /** Prefills the owner UID of a new profile (the screen's UID filter). */
  defaultUid?: number
  onClose: () => void
}

export function ProfileFormSheet({ target, defaultUid, onClose }: ProfileFormSheetProps) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
        {/* Keyed so the form starts fresh for every target. */}
        {target && (
          <ProfileForm
            key={target === 'new' ? 'new' : target.profile_id}
            profile={target === 'new' ? null : target}
            defaultUid={defaultUid}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

type FieldName = 'uid' | 'name' | 'phone' | 'email' | 'avatar'
type FieldErrors = Partial<Record<FieldName, string>>

type SaveInput =
  | { mode: 'create'; fields: ProfileFieldsInput & { uid: number; name: string; school_id?: number }; avatar?: File }
  | { mode: 'update'; profileId: number; fields: ProfileFieldsInput; school: SchoolChange; avatar?: File }

/** Radix Select items can't have an empty value, so "nothing picked" gets its own. */
const NONE = 'none'

/** Every curriculum list is short; one request of the max size (1000) holds it. */
const OPTIONS_PAGE = { page: 1, size: 1000 }

/** Characters as MySQL VARCHAR counts them, not UTF-16 units. */
function charCount(value: string) {
  return Array.from(value).length
}

/** The server's dob ("YYYYMMDD000000.000000") as an <input type="date"> value. */
function toDateInput(value: string | undefined) {
  return parseServerTime(value)?.toISOString().slice(0, 10) ?? ''
}

function idOrNone(id: number | undefined) {
  return id === undefined ? NONE : String(id)
}

function ProfileForm({ profile, defaultUid, onClose }: { profile: Profile | null; defaultUid?: number; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [role, setRole] = useState<ProfileRole>(profile?.role ?? 'STUDENT')
  const [programId, setProgramId] = useState(idOrNone(profile?.program_id))
  const [gradeId, setGradeId] = useState(idOrNone(profile?.grade_id))
  const [semesterId, setSemesterId] = useState(idOrNone(profile?.semester_id))
  const [schoolId, setSchoolId] = useState(idOrNone(profile?.school_id))
  const [isDefault, setIsDefault] = useState(profile?.is_default ?? false)

  const save = useMutation({
    mutationFn: (input: SaveInput) =>
      input.mode === 'create'
        ? createProfile(input.fields, input.avatar)
        : updateProfile(input.profileId, input.fields, input.school, input.avatar),
    meta: { silentError: true },
    // Also on error: a save is up to three calls, and the first ones may have gone through.
    onSettled: () => queryClient.invalidateQueries({ queryKey: profilesQueryKey }),
    onSuccess: () => {
      toast.success(t(profile ? 'profiles.form.updated' : 'profiles.form.created'))
      onClose()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim()
    const errors: FieldErrors = {}

    const uid = Number(text('uid'))
    if (!profile && !(Number.isInteger(uid) && uid > 0)) errors.uid = t('profiles.form.errors.uid')

    const name = text('name')
    if (!name) errors.name = t('profiles.form.errors.required')
    else if (charCount(name) > PROFILE_LIMITS.name)
      errors.name = t('profiles.form.errors.tooLong', { max: PROFILE_LIMITS.name })

    const phone = text('phone')
    if (charCount(phone) > PROFILE_LIMITS.phone)
      errors.phone = t('profiles.form.errors.tooLong', { max: PROFILE_LIMITS.phone })

    const email = text('email')
    if (email && !isValidEmail(email)) errors.email = t('profiles.form.errors.email')
    else if (charCount(email) > PROFILE_LIMITS.email)
      errors.email = t('profiles.form.errors.tooLong', { max: PROFILE_LIMITS.email })

    const file = form.get('avatar')
    const avatar = file instanceof File && file.size > 0 ? file : undefined
    if (avatar && !avatar.type.startsWith('image/')) errors.avatar = t('profiles.form.errors.avatarType')
    else if (avatar && avatar.size > AVATAR_MAX_BYTES) errors.avatar = t('profiles.form.errors.avatarSize')

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const dob = text('dob')
    // Role-specific ids: the inputs only exist for their role, so the others read as ''.
    const idType = role === 'TEACHER' ? text('id_type') : ''
    const teacherId = role === 'TEACHER' ? text('teacher_id') : ''
    const studentId = role === 'STUDENT' ? text('student_id') : ''
    const pickedId = (value: string) => (value === NONE ? undefined : Number(value))

    if (!profile) {
      save.mutate({
        mode: 'create',
        avatar,
        fields: {
          uid,
          name,
          role,
          phone: phone || undefined,
          email: email || undefined,
          is_default: isDefault,
          dob: dob || undefined,
          program_id: pickedId(programId),
          grade_id: pickedId(gradeId),
          semester_id: pickedId(semesterId),
          school_id: pickedId(schoolId),
          id_type: idType || undefined,
          teacher_id: teacherId || undefined,
          student_id: studentId || undefined,
        },
      })
      return
    }

    // Edit: send only what changed. An emptied text field is sent as "" to clear it.
    const changed = (next: string, current: string | null | undefined) => (next !== (current ?? '') ? next : undefined)
    const changedId = (next: string, current: number | undefined) =>
      next !== idOrNone(current) ? pickedId(next) : undefined
    const fields: ProfileFieldsInput = {
      name: changed(name, profile.name),
      phone: changed(phone, profile.phone),
      email: changed(email, profile.email),
      role: role !== profile.role ? role : undefined,
      is_default: isDefault && !profile.is_default ? true : undefined,
      // An emptied date can't be cleared on the server; leave it unchanged.
      dob: dob && dob !== toDateInput(profile.dob) ? dob : undefined,
      program_id: changedId(programId, profile.program_id),
      grade_id: changedId(gradeId, profile.grade_id),
      semester_id: changedId(semesterId, profile.semester_id),
      id_type: role === 'TEACHER' ? changed(idType, profile.id_type) : undefined,
      teacher_id: role === 'TEACHER' ? changed(teacherId, profile.teacher_id) : undefined,
      student_id: role === 'STUDENT' ? changed(studentId, profile.student_id) : undefined,
    }
    const school: SchoolChange =
      schoolId === idOrNone(profile.school_id)
        ? undefined
        : schoolId === NONE
          ? { kind: 'remove' }
          : { kind: 'assign', schoolId: Number(schoolId) }

    if (!avatar && !school && Object.values(fields).every((value) => value === undefined)) {
      onClose() // nothing changed
      return
    }
    save.mutate({ mode: 'update', profileId: profile.profile_id, fields, school, avatar })
  }

  const describedBy = (name: FieldName, hasHint = false) =>
    fieldErrors[name] ? `${name}-error` : hasHint ? `${name}-hint` : undefined

  const displayName = profile ? profile.name || profile.profile_code : ''

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-bold">{t(profile ? 'profiles.editTitle' : 'profiles.create')}</SheetTitle>
        <SheetDescription className="sr-only">{t('profiles.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {profile && (
          <div className="flex items-center gap-3.5 rounded-xl border border-secondary bg-muted/40 p-4">
            <Avatar className="size-12">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
              <AvatarFallback className="bg-secondary font-bold text-primary">{initialsOf(displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <strong className="truncate font-semibold">{displayName}</strong>
              <span className="font-mono text-[13px] text-muted-foreground">
                {profile.profile_code} · ID {profile.profile_id} · UID {profile.uid}
              </span>
            </div>
          </div>
        )}

        {save.isError && <FormAlert>{getErrorMessage(save.error)}</FormAlert>}

        <div className="flex flex-col gap-4">
          {!profile && (
            <FormField id="uid" label={t('profiles.form.uid')} error={fieldErrors.uid} hint={t('profiles.form.uidHint')}>
              <Input
                id="uid"
                name="uid"
                inputMode="numeric"
                autoComplete="off"
                autoFocus={defaultUid === undefined}
                defaultValue={defaultUid ?? ''}
                aria-invalid={!!fieldErrors.uid}
                aria-describedby={describedBy('uid', true)}
                className="h-11 w-48 rounded-xl font-mono"
              />
            </FormField>
          )}

          <FormField id="name" label={t('profiles.form.name')} error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoFocus={!profile && defaultUid !== undefined}
              defaultValue={profile?.name ?? ''}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={describedBy('name')}
              className="h-11 rounded-xl"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="role" label={t('profiles.form.role')}>
              <Select value={role} onValueChange={(value) => setRole(value as ProfileRole)}>
                <SelectTrigger id="role" className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_ROLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`users.roles.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="dob" label={t('profiles.form.dob')}>
              <Input
                id="dob"
                name="dob"
                type="date"
                defaultValue={toDateInput(profile?.dob)}
                className="h-11 rounded-xl"
              />
            </FormField>
          </div>

          {role === 'TEACHER' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="id_type" label={t('profiles.form.idType')} hint={t('profiles.form.idTypeHint')}>
                <Input
                  id="id_type"
                  name="id_type"
                  defaultValue={profile?.id_type ?? ''}
                  aria-describedby="id_type-hint"
                  className="h-11 rounded-xl"
                />
              </FormField>
              <FormField id="teacher_id" label={t('profiles.form.teacherId')}>
                <Input
                  id="teacher_id"
                  name="teacher_id"
                  defaultValue={profile?.teacher_id ?? ''}
                  className="h-11 rounded-xl"
                />
              </FormField>
            </div>
          )}
          {role === 'STUDENT' && (
            <FormField id="student_id" label={t('profiles.form.studentId')}>
              <Input
                id="student_id"
                name="student_id"
                defaultValue={profile?.student_id ?? ''}
                className="h-11 rounded-xl"
              />
            </FormField>
          )}
          <span className="-mt-2 text-[13px] text-muted-foreground">{t('profiles.form.officialHint')}</span>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="phone" label={t('profiles.form.phone')} error={fieldErrors.phone}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ''}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={describedBy('phone')}
                className="h-11 rounded-xl"
              />
            </FormField>
            <FormField id="email" label={t('profiles.form.email')} error={fieldErrors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={profile?.email ?? ''}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={describedBy('email')}
                className="h-11 rounded-xl"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CurriculumSelect
              kind="program"
              label={t('profiles.form.program')}
              value={programId}
              onChange={setProgramId}
              clearable={profile?.program_id === undefined}
            />
            <CurriculumSelect
              kind="grade"
              label={t('profiles.form.grade')}
              value={gradeId}
              onChange={setGradeId}
              clearable={profile?.grade_id === undefined}
            />
            <CurriculumSelect
              kind="semester"
              label={t('profiles.form.semester')}
              value={semesterId}
              onChange={setSemesterId}
              clearable={profile?.semester_id === undefined}
            />
            <CurriculumSelect kind="school" label={t('profiles.form.school')} value={schoolId} onChange={setSchoolId} clearable />
          </div>
          {profile && <span className="-mt-2 text-[13px] text-muted-foreground">{t('profiles.form.curriculumHint')}</span>}

          <FormField
            id="avatar"
            label={t(profile?.avatar_url ? 'profiles.form.avatarReplace' : 'profiles.form.avatar')}
            error={fieldErrors.avatar}
            hint={t('profiles.form.avatarHint')}
          >
            <Input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/*"
              aria-invalid={!!fieldErrors.avatar}
              aria-describedby={describedBy('avatar', true)}
              className="h-11 rounded-xl pt-2.5"
            />
          </FormField>

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={isDefault}
                disabled={profile?.is_default}
                onChange={(event) => setIsDefault(event.target.checked)}
                className="size-4 accent-primary"
              />
              {t('profiles.form.isDefault')}
            </label>
            <span className="pl-6.5 text-[13px] text-muted-foreground">
              {t(profile?.is_default ? 'profiles.form.isDefaultLocked' : 'profiles.form.isDefaultHint')}
            </span>
          </div>
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 rounded-xl px-4.5" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t(profile ? 'profiles.form.save' : 'profiles.form.create')}
        </Button>
      </SheetFooter>
    </form>
  )
}

type CurriculumSelectProps = {
  kind: CurriculumKind
  label: string
  /** An id as a string, or NONE. */
  value: string
  onChange: (value: string) => void
  /** Offers "none". The server can't clear a program, grade or semester once set. */
  clearable: boolean
}

/** Picks a program, grade, semester or school from its (short) list. */
function CurriculumSelect({ kind, label, value, onChange, clearable }: CurriculumSelectProps) {
  const { t } = useTranslation()
  const options = useQuery(curriculumListQueryOptions(kind, OPTIONS_PAGE))
  const items = options.data?.items ?? []
  // A soft-deleted row is no longer listed but can still be linked; keep it selectable as its id.
  const missing = value !== NONE && options.data && !items.some((item) => String(item.id) === value)

  return (
    <FormField id={kind} label={label}>
      <Select value={value} onValueChange={onChange} disabled={options.isPending}>
        <SelectTrigger id={kind} className="h-11 w-full rounded-xl">
          <SelectValue placeholder={t('profiles.form.loadingOptions')} />
        </SelectTrigger>
        <SelectContent>
          {clearable && <SelectItem value={NONE}>{t('profiles.form.none')}</SelectItem>}
          {missing && <SelectItem value={value}>#{value}</SelectItem>}
          {items.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}
