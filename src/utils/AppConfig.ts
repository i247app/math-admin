import type { AppLocale } from "@/types/I18n";

const locales = [
  { id: "vi", name: "Tiếng Việt" },
  { id: "en", name: "English" },
] as const satisfies readonly AppLocale[];

/** Centralized application configuration */
export const AppConfig = {
  name: "NUMI Admin",
  version: "0.1.0",
  i18n: {
    locales,
    defaultLocale: "vi" as AppLocale["id"],
    storageKey: "numi-admin.locale",
  },
  api: {
    /** Same-origin prefix; the Vite dev proxy and nginx on the EC2 host (`location /go/`) forward it to math-svr. */
    basePath: "/go",
    deviceName: "math-admin",
    tokenStorageKey: "numi-admin.auth-token",
    deviceUuidStorageKey: "numi-admin.device-uuid",
  },
} as const;

export const AllLocales: AppLocale["id"][] = AppConfig.i18n.locales.map(
  (locale) => locale.id,
);
