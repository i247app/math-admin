/** Source: math-svr internal/application/dto/user/user_dto.go (UserResponse). */
import type { OffsetPagination } from '@/types/Api'

/** internal/shared/enum/role.go. ADMIN exists but can never be set through /users/update. */
export type UserRole = 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN'

/** Every role, in display order. /users/list can filter on any of them. */
export const ALL_ROLES = ['STUDENT', 'TEACHER', 'PARENT', 'ADMIN'] as const satisfies readonly UserRole[]

/** Roles /users/update accepts (RoleType.IsSelfAssignable). */
export const ASSIGNABLE_ROLES = ['STUDENT', 'TEACHER', 'PARENT'] as const satisfies readonly UserRole[]

export type IdentityCode = 'GUEST' | 'USER' | 'VERIFIED'

export type User = {
  uid: number
  name: string
  email?: string
  is_email_verified: boolean
  /** E.164, e.g. "+84912345678". */
  phone?: string
  /** null = guest */
  role: UserRole | null
  identity_code: IdentityCode | null
  avatar_key?: string
  /** Presigned and short-lived — display it, don't store it. */
  avatar_url?: string
  /** "YYYYMMDDHHmmss.ffffff" — parse with parseServerTime. */
  create_dt: string
  modify_dt: string
}

/**
 * POST /users/list with pagination_type OFFSET. `roles` keeps users whose role is one of
 * them; empty = everyone. Guests have no role, so any non-empty filter leaves them out.
 */
export type ListUsersRequest = {
  page: number
  size: number
  roles: UserRole[]
}

/** POST /users/list response. Active users only, newest uid first. */
export type ListUsersResponse = {
  users: User[]
  pagination: OffsetPagination
}

/**
 * POST /users/admin/create (ADMIN session only). Needs a name and a phone or an email.
 * The server normalizes the phone, stores the email unverified, defaults the role to
 * STUDENT and opens the account's first child profile. The new user's first sign-in
 * goes through OTP.
 */
export type CreateUserRequest = {
  name: string
  phone?: string
  email?: string
  role?: UserRole
  /** 8+ characters, at most 72 bytes (internal/domain/login/password.go). Omitted = OTP-only login. */
  password?: string
}

/**
 * POST /users/update. Omitted fields stay unchanged. email / phone only
 * replace a contact the account already has — the server ignores them otherwise.
 */
export type UpdateUserRequest = {
  uid: number
  name?: string
  email?: string
  phone?: string
  role?: (typeof ASSIGNABLE_ROLES)[number]
}
