import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LockKeyholeIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { FormAlert } from '@/components/FormAlert'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, sendLoginOtp, sessionQueryOptions } from '@/features/auth/AuthApi'
import { getErrorMessage } from '@/libs/ApiClient'
import type { VerifyOtpState } from '@/types/Auth'

export default function SignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signIn = useMutation({
    mutationFn: async ({ loginName, password }: { loginName: string; password: string }) => {
      const res = await login(loginName, password)
      if (res.is_trusted) return { trusted: true as const, user: res.user }
      // Untrusted browser: send the code here, once, so the OTP screen never
      // requests one on its own (an effect would fire twice under StrictMode).
      const challenge = await sendLoginOtp(loginName)
      return { trusted: false as const, challenge }
    },
    // Shown inside the form instead of a toast.
    meta: { silentError: true },
    onSuccess: (result, { loginName }) => {
      if (result.trusted) {
        queryClient.setQueryData(sessionQueryOptions.queryKey, result.user)
        void navigate('/', { replace: true })
      } else {
        // The session stays unsecure until the OTP is verified.
        void navigate('/verify-otp', {
          state: { identifier: loginName, ...result.challenge } satisfies VerifyOtpState,
        })
      }
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    signIn.mutate({
      loginName: String(form.get('loginName')).trim(),
      password: String(form.get('password')),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t('auth.signIn.title')}</h1>
        <p className="text-muted-foreground">{t('auth.signIn.description')}</p>
      </div>

      {signIn.isError && <FormAlert>{getErrorMessage(signIn.error)}</FormAlert>}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="loginName">{t('auth.signIn.loginName')}</Label>
          <Input
            id="loginName"
            name="loginName"
            autoComplete="username"
            placeholder={t('auth.signIn.loginNamePlaceholder')}
            required
            autoFocus
            className="h-12 rounded-xl bg-card px-3.5"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t('auth.signIn.password')}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            className="h-12 rounded-xl bg-card px-3.5"
          />
        </div>
      </div>

      <Button type="submit" disabled={signIn.isPending} className="h-12 rounded-xl text-[15px] font-semibold">
        {signIn.isPending ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
      </Button>

      <div className="flex items-start gap-2.5 rounded-xl bg-accent px-3.5 py-3 text-[13px] leading-normal text-muted-foreground">
        <LockKeyholeIcon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
        <span>{t('auth.signIn.otpHint')}</span>
      </div>
    </form>
  )
}
