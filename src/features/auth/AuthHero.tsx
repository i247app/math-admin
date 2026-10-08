import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { AppConfig } from '@/utils/AppConfig'

/** Teal brand panel shown beside the sign-in and OTP forms. */
export function AuthHero() {
  const { t } = useTranslation()

  return (
    <section className="bg-grid-paper flex flex-col justify-between gap-12 bg-sidebar p-8 text-sidebar-foreground md:p-12">
      <Logo />
      <div className="flex max-w-md flex-col gap-4">
        <h2 className="text-4xl leading-tight font-bold text-white">{t('auth.heroTitle')}</h2>
        <p className="text-base leading-relaxed">{t('auth.heroDescription')}</p>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/numi-mascot.png`}
          alt={t('auth.mascotAlt')}
          className="w-64 max-w-[70%]"
        />
      </div>
      <span className="text-xs text-sidebar-foreground/80">math-admin {AppConfig.version}</span>
    </section>
  )
}
