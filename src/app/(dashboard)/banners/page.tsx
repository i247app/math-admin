import { useTranslation } from 'react-i18next'
import { TitleBar } from '@/features/dashboard/TitleBar'

export default function BannersPage() {
  const { t } = useTranslation()

  return (
    <>
      <TitleBar title={t('banners.title')} description={t('banners.description')} />
      <p className="text-sm text-muted-foreground">{t('common.comingSoon')}</p>
    </>
  )
}
