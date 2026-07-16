import DateObject from "react-date-object"
import gregorian from "react-date-object/calendars/gregorian"
import persian from "react-date-object/calendars/persian"
import gregorianEn from "react-date-object/locales/gregorian_en"
import persianFa from "react-date-object/locales/persian_fa"
import {
  formatCurrency,
  formatDate as formatDateIntl,
  formatNumber,
  getIntlLocale,
  isRtlLocale,
  normalizeUiLocale,
  toLatinDigits,
  toLocaleDigits,
  type UiLocale,
} from "@webina/ui"

import { normalizeUiLocale as normalizeAppUiLocale } from "@/i18n/locales"

export type AppLocale = UiLocale

export {
  formatCurrency,
  formatNumber,
  getIntlLocale,
  isRtlLocale,
  normalizeUiLocale,
  toLatinDigits,
  toLocaleDigits,
}

/** @deprecated Prefer `toLocaleDigits` from `@webina/ui`. */
export const localizeDigits = toLocaleDigits

export function toAppLocale(lng: string): AppLocale {
  return normalizeAppUiLocale(lng) === "fa" ? "fa" : "en"
}

export function getCalendarConfig(lang?: AppLocale) {
  const l = lang ?? "fa"
  if (l === "fa") {
    return { calendar: persian, locale: persianFa }
  }
  return { calendar: gregorian, locale: gregorianEn }
}

function parseInputDate(input: string): DateObject | null {
  if (!input || input.trim() === "" || input === "-") {
    return null
  }
  const trimmed = input.trim()
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return new DateObject(trimmed)
    }
    return new DateObject({ date: trimmed, calendar: persian, locale: persianFa })
  } catch {
    return null
  }
}

export type FormatDateOptions = {
  lang?: AppLocale
  includeTime?: boolean
  timeZone?: string
}

/**
 * Panel display formatter (Jalali for `fa`). Prefer ISO Gregorian strings as input.
 * For plain Intl formatting, use `formatDateIntl` / `@webina/ui` `formatDate`.
 */
export function formatDate(input: string, options?: FormatDateOptions): string {
  const lang = options?.lang ?? "fa"
  const d = parseInputDate(input)
  if (!d) {
    return input || "—"
  }

  if (options?.timeZone) {
    return formatDateIntl(input, lang, {
      includeTime: options.includeTime,
      timeZone: options.timeZone,
    })
  }

  if (lang === "fa") {
    const jalali = d.convert(persian)
    if (options?.includeTime && input.includes(":")) {
      return toLocaleDigits(jalali.format("YYYY/MM/DD HH:mm"), "fa")
    }
    return toLocaleDigits(jalali.format("YYYY/MM/DD"), "fa")
  }

  const g = d.convert(gregorian)
  if (options?.includeTime && input.includes(":")) {
    return g.format("YYYY/MM/DD HH:mm")
  }
  return g.format("YYYY/MM/DD")
}

export { formatDateIntl }

export function formatDateTime(input: string, lang?: AppLocale, timeZone?: string): string {
  return formatDate(input, { lang, includeTime: true, timeZone })
}

export function formatLocalizedDate(
  lang: AppLocale,
  date: Date,
  timeZone = "UTC",
): string {
  return formatDateIntl(date, lang, { timeZone })
}

export function formatNowDate(lang: AppLocale, timeZone = "UTC"): string {
  return formatLocalizedDate(lang, new Date(), timeZone)
}

/** @deprecated Use formatNumber from @webina/ui */
export function formatInteger(value: number, locale: string): string {
  return formatNumber(value, normalizeUiLocale(locale))
}
