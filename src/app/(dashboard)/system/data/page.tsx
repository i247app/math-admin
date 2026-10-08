import { useTranslation } from 'react-i18next'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ClearAllDataCard } from '@/features/system/ClearAllDataCard'
import { ClearTablesCard } from '@/features/system/ClearTablesCard'
import { DbPoolStatsCard } from '@/features/system/DbPoolStatsCard'

export default function DataPage() {
  const { t } = useTranslation()

  return (
    <>
      <TitleBar title={t('system.data.title')} description={t('system.data.description')} />
      <DbPoolStatsCard />
      <ClearTablesCard />
      <ClearAllDataCard />
    </>
  )
}
