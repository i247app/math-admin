/** /roles/* calls of the permission module (docs/API-CONTRACT.md §4). */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost, apiPostMultipart } from '@/libs/ApiClient'
import type { OffsetPageRequest } from '@/types/Api'
import type { EditableRoleStatus, ListRolesResponse, RoleFieldsInput } from '@/types/Role'

/** Limits of internal/module/permission/validator.go, counted in characters (MySQL VARCHAR), not bytes. */
export const ROLE_LIMITS = { name: 128, description: 500, note: 500 } as const

/** roleCodePattern in the validator; the server upper-cases and trims before matching. */
export const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

/** MaxRoleImageUploadSize in internal/module/permission/handler.go. */
export const ROLE_IMAGE_MAX_BYTES = 10 << 20

/** Every roles query starts with this key — invalidate it after any change. */
export const rolesQueryKey = ['roles'] as const

export type RolesListParams = OffsetPageRequest & {
  /** Matches role_code or role_name (LIKE %…%). */
  search?: string
  status?: EditableRoleStatus
}

export function rolesListQueryOptions({ page, size, search, status }: RolesListParams) {
  return queryOptions({
    queryKey: [...rolesQueryKey, 'list', { page, size, search, status }],
    queryFn: async ({ signal }) => {
      // OFFSET only; soft-deleted rows never come back. Sorted by role_code, then id.
      const res = await apiPost<ListRolesResponse>(
        '/roles/list',
        { page, size, search: search || undefined, role_status: status },
        { signal },
      )
      return { roles: res.roles ?? [], pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

/**
 * JSON, or multipart when there is an image (file part `role_image`). The screen
 * refetches the list afterwards, so the created row in the response is not returned.
 */
export async function createRole(input: RoleFieldsInput & { role_code: string }, image?: File) {
  if (image) {
    await apiPostMultipart('/roles/create', { ...input, role_image: image })
  } else {
    await apiPost('/roles/create', input)
  }
}

export type RoleImageChange = { kind: 'replace'; file: File } | { kind: 'remove' } | undefined

/**
 * Field changes go as JSON: the multipart form reads an empty value as "unchanged",
 * so it can't clear a description or note. A new image follows in an image-only
 * multipart call, which leaves every other column as it is.
 */
export async function updateRole(roleId: number, changes: RoleFieldsInput, image: RoleImageChange) {
  const removeImage = image?.kind === 'remove'
  if (removeImage || Object.values(changes).some((value) => value !== undefined)) {
    await apiPost('/roles/update', { role_id: roleId, ...changes, remove_role_image: removeImage || undefined })
  }
  if (image?.kind === 'replace') {
    await apiPostMultipart('/roles/update', { role_id: roleId, role_image: image.file })
  }
}

/** Marks the role DELETED and hides it from every read; frees its code. No restore endpoint. */
export function softDeleteRole(roleId: number) {
  return apiPost('/roles/soft-delete', { role_id: roleId })
}

/** Physically deletes the row. Irreversible. */
export function forceDeleteRole(roleId: number) {
  return apiPost('/roles/force-delete', { role_id: roleId })
}
