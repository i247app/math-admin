import type vi from '@/locales/vi.json'

// Type-checks t('...') keys against the Vietnamese catalog (the source of truth).
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      translation: typeof vi
    }
  }
}
