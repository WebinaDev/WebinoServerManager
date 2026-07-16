"use client"

import { useMemo } from "react"
import { useTranslations, useLocale as useIntlLocale } from "next-intl"

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
  const t = useTranslations("common")
  const intlLocale = useIntlLocale()
  const lang: AppLocale = toAppLocale(intlLocale)
  const isRtl = isRtlLocale(lang)
  const dir = isRtl ? "rtl" : "ltr"

  return useMemo(
    () => ({
      t,
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
    [t, lang, isRtl, dir],
  )
}
