/**
 * Role registry of the permission module (ma_roles).
 * Source: math-svr internal/application/dto/role/role_dto.go, internal/module/permission/.
 * Not the same thing as User.role: nothing on the server consults this registry yet.
 */
import type { OffsetPagination } from '@/types/Api'

/** DELETED is set only by /roles/soft-delete; create/update/list accept ACTIVE and INACTIVE. */
export type RoleStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED'

export const EDITABLE_ROLE_STATUSES = ['ACTIVE', 'INACTIVE'] as const satisfies readonly RoleStatus[]

export type EditableRoleStatus = (typeof EDITABLE_ROLE_STATUSES)[number]

export type Role = {
  role_id: number
  /** Machine key: upper-case, starts with a letter, [A-Z0-9_], ≤ 64 chars. Cannot be changed. */
  role_code: string
  role_name: string
  description?: string
  role_image_key?: string
  /** Presigned and short-lived — display it, don't store it. null when there is no image. */
  role_image_url: string | null
  note?: string
  role_status?: RoleStatus
  /** "YYYYMMDDHHmmss.ffffff" — parse with parseServerTime. */
  create_dt: string
  modify_dt: string
}

export type ListRolesResponse = { roles: Role[] | null; pagination: OffsetPagination }

/** Text fields of the create/edit form. Undefined = left out of the request (unchanged on update). */
export type RoleFieldsInput = {
  role_name?: string
  description?: string
  note?: string
  role_status?: EditableRoleStatus
}
