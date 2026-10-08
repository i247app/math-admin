/**
 * Source: math-svr internal/application/dto/auth/auth_dto.go,
 * internal/application/dto/otp/otp_dto.go.
 */
import type { User } from '@/types/User'

/** The only otp_type the admin sign-in uses. */
export const LOGIN_OTP_TYPE = 'LOGIN_2FA'

/** Digits in a code (math-svr internal/application/command/otp/policy.go, OtpCodeLength). */
export const OTP_LENGTH = 4

/**
 * /otps/verify answers meaning the current code can no longer be used, so a
 * new one may be requested (math-svr internal/domain/shared/status/code.go).
 */
export const OTP_DEAD_STATUSES: readonly number[] = [
  4701, // OTP_NOT_FOUND
  4707, // OTP_EXPIRED
  4709, // OTP_REVOKED
  4710, // OTP_TOO_MANY_ATTEMPTS
]

/** POST /auth/login and /auth/resume-session. */
export type LoginResponse = {
  /** true: the session is secure now, sign-in is done. */
  is_trusted: boolean
  /** true: the session stays unsecure until /otps/verify succeeds. */
  required_otp: boolean
  user: User | null
}

/** POST /otps/send. */
export type SendOtpResponse = {
  /** UTC, "YYYYMMDDHHmmss.ffffff" — parse with parseServerTime. */
  expires_at: string
  otp_type: string
  /** Echoed back while SMS/email delivery isn't wired on the server (dev). */
  otp_code?: string
}

/** POST /otps/verify. On success the device is trusted and the session secure. */
export type VerifyOtpResponse = {
  verified: boolean
  otp_type: string
  user?: User | null
}

/** A sent code, as the OTP screen needs it. Plain values so it survives router state. */
export type OtpChallenge = {
  /** Epoch ms; null when the server's expires_at could not be parsed. */
  expiresAt: number | null
  /** otp_code echoed by the server (dev only). */
  devCode: string | null
}

/** Router state the sign-in page hands to /verify-otp, after it has sent the code. */
export type VerifyOtpState = OtpChallenge & {
  /** The login_name just used; /otps/send and /otps/verify need the same value. */
  identifier: string
}
