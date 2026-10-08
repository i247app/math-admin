import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.json'
import vi from '@/locales/vi.json'
import type { AppLocale } from '@/types/I18n'
import { AllLocales, AppConfig } from '@/utils/AppConfig'

const { defaultLocale, storageKey } = AppConfig.i18n

function readStoredLocale(): AppLocale['id'] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && (AllLocales as string[]).includes(stored)) {
      return stored as AppLocale['id']
    }
  } catch {
    // Storage can be blocked (private mode); fall back to the default locale.
  }
  return defaultLocale
}

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false }, // React already escapes output
})

document.documentElement.lang = i18n.language

i18n.on('languageChanged', (locale) => {
  document.documentElement.lang = locale
  try {
    localStorage.setItem(storageKey, locale)
  } catch {
    // Not persisted; the choice still applies for this tab.
  }
})

export default i18n
