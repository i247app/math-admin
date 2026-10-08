/**
 * Sign-in calls (docs/API-CONTRACT.md §3) and the session query every
 * signed-in screen reads.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiPost, clearAuthToken, hasAuthToken } from '@/libs/ApiClient'
import type { LoginResponse, OtpChallenge, SendOtpResponse, VerifyOtpResponse } from '@/types/Auth'
import { LOGIN_OTP_TYPE } from '@/types/Auth'
import type { User } from '@/types/User'
import { parseServerTime } from '@/utils/Helpers'

/**
 * The signed-in user, restored from the stored token with /auth/resume-session.
 * `null` = no session. Sign-in and OTP verify write it with setQueryData.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async ({ signal }): Promise<User | null> => {
    // No token: nothing to resume, and skipping the call avoids the 401 redirect.
    if (!hasAuthToken()) return null
    const res = await apiPost<LoginResponse>('/auth/resume-session', {}, { signal })
    return res.user ?? null
  },
  // Changes only through sign-in / sign-out, which update the cache themselves.
  staleTime: Infinity,
})

/** The signed-in user, for screens under (dashboard)/layout.tsx — which only renders them once there is one. */
export function useSessionUser(): User {
  const { data } = useQuery(sessionQueryOptions)
  if (!data) throw new Error('useSessionUser() used outside the signed-in layout')
  return data
}

export function login(loginName: string, password: string) {
  return apiPost<LoginResponse>('/auth/login', { login_name: loginName, password })
}

/**
 * Sends the LOGIN_2FA code. While an earlier code is still valid the server
 * hands that one back (same expiry) instead of sending a new one, so calling
 * this again before expiry is harmless.
 */
export async function sendLoginOtp(identifier: string): Promise<OtpChallenge> {
  const res = await apiPost<SendOtpResponse>('/otps/send', { otp_type: LOGIN_OTP_TYPE, identifier })
  return { expiresAt: parseServerTime(res.expires_at)?.getTime() ?? null, devCode: res.otp_code || null }
}

export function verifyLoginOtp(identifier: string, otpCode: string) {
  return apiPost<VerifyOtpResponse>('/otps/verify', {
    otp_type: LOGIN_OTP_TYPE,
    identifier,
    otp_code: otpCode,
  })
}

/** Ends the session on the server, then forgets the token even if that call failed. */
export async function logout() {
  try {
    await apiPost('/auth/logout')
  } finally {
    clearAuthToken()
  }
}
