"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  formatDate,
  formatDateTime,
  formatLocalizedDate,
  formatNowDate,
  formatNumber,
  getCalendarConfig,
  isRtlLocale,
  localizeDigits,
  toAppLocale,
  type AppLocale,
} from "@/lib/locale"

export function useLocale() {
  const { t, i18n } = useTranslation()
  const lang: AppLocale = toAppLocale(i18n.resolvedLanguage ?? i18n.language)
  const isRtl = isRtlLocale(lang)
  const dir = isRtl ? "rtl" : "ltr"

  return useMemo(
    () => ({
      t,
      i18n,
      lang,
      isRtl,
      dir,
      formatNumber: (n: number) => formatNumber(n, lang),
      localizeDigits: (s: string) => localizeDigits(s, lang),
      formatDate: (iso: string, opts?: { includeTime?: boolean; timeZone?: string }) =>
        formatDate(iso, { lang, includeTime: opts?.includeTime, timeZone: opts?.timeZone }),
      formatDateTime: (iso: string, timeZone?: string) =>
        formatDateTime(iso, lang, timeZone),
      formatLocalizedDate: (date: Date, timeZone?: string) =>
        formatLocalizedDate(lang, date, timeZone),
      formatNowDate: (timeZone?: string) => formatNowDate(lang, timeZone),
      getCalendarConfig: () => getCalendarConfig(lang),
    }),
    [t, i18n, lang, isRtl, dir],
  )
}
