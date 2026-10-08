/** /profiles/* calls (docs/API-CONTRACT.md §4). */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost, apiPostMultipart } from '@/libs/ApiClient'
import type { ListProfilesRequest, ListProfilesResponse, Profile, ProfileFieldsInput } from '@/types/Profile'

/** MaxAvatarUploadSize in internal/module/profile/handler.go. */
export const AVATAR_MAX_BYTES = 10 << 20

/** VARCHAR sizes of ma_profiles (migrations), counted in characters. */
export const PROFILE_LIMITS = { name: 128, phone: 128, email: 128 } as const

/** Every profiles query starts with this key — invalidate it after any change. */
export const profilesQueryKey = ['profiles'] as const

/** The Profiles screen filtered to one account; the Users screen links here. */
export function userProfilesPath(uid: number) {
  return `/profiles?uid=${uid}`
}

export function profilesListQueryOptions(request: ListProfilesRequest) {
  return queryOptions({
    queryKey: [...profilesQueryKey, 'list', request],
    queryFn: async ({ signal }) => {
      const res = await apiPost<ListProfilesResponse>('/profiles/list', request, { signal })
      return { profiles: res.profiles ?? [], pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

export function profileDetailQueryOptions(profileId: number) {
  return queryOptions({
    queryKey: [...profilesQueryKey, 'detail', profileId],
    queryFn: async ({ signal }) => {
      const res = await apiPost<{ profile: Profile }>('/profiles/detail', { profile_id: profileId }, { signal })
      return res.profile
    },
  })
}

/**
 * Creates as JSON, then uploads the avatar the same way an edit does. (The multipart
 * form of /profiles/create skips phone and email.) The screen refetches the list
 * afterwards, so the created row is not returned.
 */
export async function createProfile(
  input: ProfileFieldsInput & { uid: number; name: string; school_id?: number },
  avatar?: File,
) {
  const res = await apiPost<{ profile: Profile }>('/profiles/create', input)
  if (avatar) await uploadAvatar(res.profile.profile_id, avatar)
}

export type SchoolChange = { kind: 'assign'; schoolId: number } | { kind: 'remove' } | undefined

/**
 * Up to three calls, each skipped when it has nothing to do: the field patch as JSON,
 * the school link (assign/remove can clear it, /profiles/update can't), then the avatar
 * through /profiles/upload-avatar (multipart, file part `file`).
 */
export async function updateProfile(
  profileId: number,
  changes: ProfileFieldsInput,
  school: SchoolChange,
  avatar?: File,
) {
  if (Object.values(changes).some((value) => value !== undefined)) {
    await apiPost('/profiles/update', { profile_id: profileId, ...changes })
  }
  if (school?.kind === 'assign') {
    await apiPost('/profiles/assign-school', { profile_id: profileId, school_id: school.schoolId })
  } else if (school?.kind === 'remove') {
    await apiPost('/profiles/remove-school', { profile_id: profileId })
  }
  if (avatar) await uploadAvatar(profileId, avatar)
}

/** Stores the file in S3 and points the profile at it. The old object is not deleted. */
function uploadAvatar(profileId: number, file: File) {
  return apiPostMultipart('/profiles/upload-avatar', { profile_id: profileId, file })
}

/** Marks the profile DELETED and hides it from every read. No restore endpoint. */
export function softDeleteProfile(profileId: number) {
  return apiPost('/profiles/soft-delete', { profile_id: profileId })
}

/** Physically deletes the row and its avatar. Irreversible. */
export function forceDeleteProfile(profileId: number) {
  return apiPost('/profiles/force-delete', { profile_id: profileId })
}
