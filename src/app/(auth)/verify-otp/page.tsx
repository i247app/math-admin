import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { sendLoginOtp, sessionQueryOptions, verifyLoginOtp } from '@/features/auth/AuthApi'
import { ApiError, getErrorMessage } from '@/libs/ApiClient'
import type { OtpChallenge, VerifyOtpState } from '@/types/Auth'
import { OTP_DEAD_STATUSES, OTP_LENGTH } from '@/types/Auth'

export default function VerifyOtpPage() {
  const state = useLocation().state as VerifyOtpState | null
  // Reached without signing in first (direct link, new tab): nothing to verify.
  if (!state?.identifier) return <Navigate to="/sign-in" replace />
  const { identifier, ...firstChallenge } = state
  return <VerifyOtpForm identifier={identifier} firstChallenge={firstChallenge} />
}

/**
 * The sign-in page already sent the first code, so nothing is requested on
 * arrival; /otps/send is only called again when the user asks for a new code.
 */
function VerifyOtpForm({ identifier, firstChallenge }: { identifier: string; firstChallenge: OtpChallenge }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(firstChallenge)
  const now = useNow()

  const send = useMutation({
    mutationFn: () => sendLoginOtp(identifier),
    meta: { silentError: true },
    onSuccess: (next) => {
      setChallenge(next)
      // Keep router state current so a reload shows the new code's expiry.
      void navigate('.', { replace: true, state: { identifier, ...next } satisfies VerifyOtpState })
    },
  })
  const verify = useMutation({
    mutationFn: (otpCode: string) => verifyLoginOtp(identifier, otpCode),
    meta: { silentError: true },
    onSuccess: (res) => {
      if (res.user) queryClient.setQueryData(sessionQueryOptions.queryKey, res.user)
      // No user in the answer: let the dashboard resume the (now secure) session.
      else queryClient.removeQueries({ queryKey: sessionQueryOptions.queryKey })
      void navigate('/', { replace: true })
    },
    // Empty the boxes so the next code can be typed straight away.
    onError: () => setCode(''),
  })

  const { expiresAt, devCode } = challenge
  const secondsLeft = expiresAt === null ? null : Math.max(0, Math.floor((expiresAt - now) / 1000))
  // The server has the last word: it may expire or revoke the code before our clock does.
  const codeDead = verify.error instanceof ApiError && OTP_DEAD_STATUSES.includes(verify.error.mstatus)
  const expired = secondsLeft === 0 || codeDead
  // A new code is only issued once the current one is unusable.
  const canResend = !send.isPending && (send.isError || expired)
  const error = verify.error ?? send.error

  function submit(otpCode: string) {
    if (otpCode.length === OTP_LENGTH && !verify.isPending) verify.mutate(otpCode)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(code)
  }

  function resend() {
    setCode('')
    verify.reset()
    send.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Link
        to="/sign-in"
        replace
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {t('auth.verifyOtp.useAnotherAccount')}
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t('auth.verifyOtp.title')}</h1>
        <p className="text-muted-foreground">
          {t('auth.verifyOtp.description', { digits: OTP_LENGTH })}{' '}
          <strong className="font-semibold break-all text-foreground">{identifier}</strong>
        </p>
      </div>

      {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t('auth.verifyOtp.codeLabel')}</legend>
        <InputOTP
          maxLength={OTP_LENGTH}
          pattern="^[0-9]*$"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={setCode}
          onComplete={submit}
          aria-label={t('auth.verifyOtp.codeLabel')}
          containerClassName="w-full"
        >
          <InputOTPGroup className="grid w-full grid-cols-4 gap-2">
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                aria-invalid={verify.isError || undefined}
                className="h-15 w-full rounded-xl border bg-card font-mono text-2xl font-semibold first:rounded-xl last:rounded-xl data-[active=true]:border-brand-coral data-[active=true]:ring-brand-coral/30"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {secondsLeft !== null && (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {expired ? (
              t('auth.verifyOtp.expired')
            ) : (
              <>
                {t('auth.verifyOtp.expiresIn')}{' '}
                <strong className="font-mono font-semibold text-foreground">{formatCountdown(secondsLeft)}</strong>
              </>
            )}
          </span>
        )}
      </fieldset>

      <Button
        type="submit"
        disabled={code.length !== OTP_LENGTH || verify.isPending || expired}
        className="h-12 rounded-xl text-[15px] font-semibold"
      >
        {verify.isPending ? t('auth.verifyOtp.submitting') : t('auth.verifyOtp.submit')}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <span>{t('auth.verifyOtp.noCode')}</span>
        <Button type="button" variant="link" className="h-auto p-0 font-semibold" disabled={!canResend} onClick={resend}>
          {send.isPending ? t('auth.verifyOtp.sending') : t('auth.verifyOtp.resend')}
        </Button>
      </div>

      {devCode && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-warning bg-warning-surface px-3.5 py-3 text-[13px] text-warning">
          <span className="rounded-md bg-warning px-2 py-0.5 text-[11px] font-bold tracking-wider text-warning-surface">
            {t('auth.verifyOtp.devBadge')}
          </span>
          <span>
            {t('auth.verifyOtp.devCode')}{' '}
            <strong className="font-mono font-semibold">{devCode}</strong>
          </span>
        </div>
      )}
    </form>
  )
}

/** Current time, refreshed every second (drives the expiry countdown). */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
