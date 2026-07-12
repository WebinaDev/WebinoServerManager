export const AR_LOCALE_ENABLED = false

export const PUBLIC_UI_LOCALES = ["en", "fa"] as const
export type PublicUiLocale = (typeof PUBLIC_UI_LOCALES)[number]
export type UiLocale = PublicUiLocale | "ar"

export function normalizeUiLocale(lng: string): UiLocale {
  if (lng.startsWith("fa")) {
    return "fa"
  }
  if (lng.startsWith("ar")) {
    return AR_LOCALE_ENABLED ? "ar" : "en"
  }
  return "en"
}

export function isPublicUiLocale(lng: string): boolean {
  const normalized = normalizeUiLocale(lng)
  return (PUBLIC_UI_LOCALES as readonly string[]).includes(normalized)
}

export function localeLabelKey(lng: string): `common:locale_${UiLocale}` {
  const normalized = normalizeUiLocale(lng)
  return `common:locale_${normalized}`
}
