import DateObject from "react-date-object"
import gregorian from "react-date-object/calendars/gregorian"
import persian from "react-date-object/calendars/persian"
import gregorianEn from "react-date-object/locales/gregorian_en"
import persianFa from "react-date-object/locales/persian_fa"

import { normalizeUiLocale } from "@/i18n/locales"

export type AppLocale = "en" | "fa"

export function toAppLocale(lng: string): AppLocale {
  return normalizeUiLocale(lng) === "fa" ? "fa" : "en"
}

export function isRtlLocale(lang?: string): boolean {
  return toAppLocale(lang ?? "fa") === "fa"
}

export function getIntlLocale(lang?: AppLocale): string {
  return (lang ?? "fa") === "fa" ? "fa-IR" : "en-US"
}

export function getCalendarConfig(lang?: AppLocale) {
  const l = lang ?? "fa"
  if (l === "fa") {
    return { calendar: persian, locale: persianFa }
  }
  return { calendar: gregorian, locale: gregorianEn }
}

export function formatNumber(value: number, lang?: AppLocale): string {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return String(value)
  }
  const useFa = (lang ?? "fa") === "fa"
  return new Intl.NumberFormat(useFa ? "fa-IR" : "en-US", {
    maximumFractionDigits: 0,
    numberingSystem: useFa ? "arabext" : "latn",
  }).format(n)
}

export function localizeDigits(text: string, lang?: AppLocale): string {
  if ((lang ?? "fa") !== "fa") {
    return text
  }
  const eastern = "۰۱۲۳۴۵۶۷۸۹"
  return text.replace(/\d/g, (d) => eastern[Number(d)] ?? d)
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

export function formatDate(input: string, options?: FormatDateOptions): string {
  const lang = options?.lang ?? "fa"
  const d = parseInputDate(input)
  if (!d) {
    return input || "—"
  }

  if (options?.timeZone) {
    const date = new Date(input)
    if (!Number.isNaN(date.getTime())) {
      if (lang === "fa") {
        return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          dateStyle: options.includeTime ? "medium" : "medium",
          timeStyle: options.includeTime ? "short" : undefined,
          numberingSystem: "arabext",
          timeZone: options.timeZone,
        }).format(date)
      }
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: options.includeTime ? "short" : undefined,
        timeZone: options.timeZone,
      }).format(date)
    }
  }

  if (lang === "fa") {
    const jalali = d.convert(persian)
    if (options?.includeTime && input.includes(":")) {
      return jalali.format("YYYY/MM/DD HH:mm")
    }
    return jalali.format("YYYY/MM/DD")
  }

  const g = d.convert(gregorian)
  if (options?.includeTime && input.includes(":")) {
    return g.format("YYYY/MM/DD HH:mm")
  }
  return g.format("YYYY/MM/DD")
}

export function formatDateTime(input: string, lang?: AppLocale, timeZone?: string): string {
  return formatDate(input, { lang, includeTime: true, timeZone })
}

export function formatLocalizedDate(
  lang: AppLocale,
  date: Date,
  timeZone = "UTC",
): string {
  if (lang === "fa") {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "medium",
      numberingSystem: "arabext",
      timeZone,
    }).format(date)
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone,
  }).format(date)
}

export function formatNowDate(lang: AppLocale, timeZone = "UTC"): string {
  return formatLocalizedDate(lang, new Date(), timeZone)
}

/** @deprecated Use formatNumber from locale.ts */
export function formatInteger(value: number, locale: string): string {
  return formatNumber(value, toAppLocale(locale))
}
