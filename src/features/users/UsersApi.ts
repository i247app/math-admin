/** /users/* calls (docs/API-CONTRACT.md §4) and the list query. */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type { CreateUserRequest, ListUsersRequest, ListUsersResponse, UpdateUserRequest, User } from '@/types/User'

/** Every users query starts with this key — invalidate it after any change. */
export const usersQueryKey = ['users'] as const

export function usersQueryOptions({ page, size, roles }: ListUsersRequest) {
  return queryOptions({
    queryKey: [...usersQueryKey, { page, size, roles }],
    queryFn: ({ signal }) =>
      apiPost<ListUsersResponse>(
        '/users/list',
        // roles left out when empty: the server reads that as "every user".
        { pagination_type: 'OFFSET', page, size, ...(roles.length > 0 && { roles }) },
        { signal },
      ),
    // Keep showing the current page while the next one loads.
    placeholderData: keepPreviousData,
  })
}

/**
 * Registers an account on someone else's behalf. Not /users/create: that one is
 * self-registration and would sign this browser in as the new user.
 */
export async function adminCreateUser(req: CreateUserRequest): Promise<User> {
  const res = await apiPost<{ user: User }>('/users/admin/create', req)
  return res.user
}

export async function updateUser(req: UpdateUserRequest): Promise<User> {
  const res = await apiPost<{ user: User }>('/users/update', req)
  return res.user
}

/**
 * Hides the account (user_status DELETED). There is no restore endpoint, and
 * the server also physically deletes every child profile of the account.
 */
export function softDeleteUser(uid: number) {
  return apiPost('/users/soft-delete', { uid })
}

/** Physically deletes the account and everything under it. Irreversible. */
export function forceDeleteUser(uid: number) {
  return apiPost('/users/force-delete', { uid })
}
