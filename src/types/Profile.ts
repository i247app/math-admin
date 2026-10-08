/**
 * Child profiles of an account (ma_profiles): one user owns several, each with its own
 * role, school and curriculum position.
 * Source: math-svr internal/application/dto/profile/profile_dto.go, internal/module/profile/.
 */
import type { OffsetPagination } from '@/types/Api'
import type { Grade, Program, School, Semester } from '@/types/Curriculum'
import type { IdentityCode } from '@/types/User'

/** Roles a profile can take (RoleType.IsSelfAssignable — never ADMIN). */
export const PROFILE_ROLES = ['STUDENT', 'TEACHER', 'PARENT'] as const

export type ProfileRole = (typeof PROFILE_ROLES)[number]

/**
 * internal/shared/enum/profile_status.go. The server derives it on every create/update:
 * OFFICIAL = a STUDENT with student_id, or a TEACHER with id_type + teacher_id; else INCOMPLETE.
 * DELETED (soft-deleted) rows never come back from a read; /profiles/list filters on the other four.
 */
export const PROFILE_STATUSES = ['OFFICIAL', 'INCOMPLETE', 'ACTIVE', 'INACTIVE'] as const

export type ProfileStatus = (typeof PROFILE_STATUSES)[number] | 'DELETED'

export type Profile = {
  profile_id: number
  /** Human code minted by the server ("AA-1234"); /profiles/list search matches it. */
  profile_code: string
  /** Owning account. */
  uid: number
  name: string
  phone: string | null
  email: string | null
  /** null on a guest profile. */
  role: ProfileRole | null
  identity_code: IdentityCode | null
  avatar_key?: string
  /** Presigned and short-lived — display it, don't store it. */
  avatar_url: string | null
  /** "YYYYMMDDHHmmss.ffffff" (a date at midnight UTC); missing when unset. */
  dob?: string
  school_id?: number
  school?: School
  program_id?: number
  program?: Program
  grade_id?: number
  grade?: Grade
  semester_id?: number
  semester?: Semester
  /** The account's default profile; at most one per uid. */
  is_default: boolean
  /** TEACHER only, e.g. MOET, PUBLIC_ID. */
  id_type?: string
  teacher_id?: string
  /** STUDENT only. */
  student_id?: string
  profile_status?: ProfileStatus
  create_dt: string
  modify_dt: string
}

/** POST /profiles/list. Every filter is optional; active rows only, newest profile_id first. */
export type ListProfilesRequest = {
  page: number
  size: number
  uid?: number
  role?: ProfileRole
  profile_status?: (typeof PROFILE_STATUSES)[number]
  /** LIKE on name or profile_code, ≤ 128 bytes. */
  search?: string
}

export type ListProfilesResponse = { profiles: Profile[] | null; pagination: OffsetPagination }

/**
 * Fields of the create/edit form. On update, undefined = unchanged and "" clears a text
 * field (the server writes COALESCE(?, col)). Curriculum ids can be changed but never
 * cleared; the school goes through /profiles/assign-school and /profiles/remove-school.
 */
export type ProfileFieldsInput = {
  name?: string
  phone?: string
  email?: string
  role?: ProfileRole
  /** Only `true` is ever applied: it makes this the account's default profile. */
  is_default?: boolean
  /** "YYYY-MM-DD". */
  dob?: string
  program_id?: number
  grade_id?: number
  semester_id?: number
  id_type?: string
  teacher_id?: string
  student_id?: string
}
