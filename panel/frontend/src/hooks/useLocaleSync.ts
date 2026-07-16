"use client"

import { useEffect } from "react"
import { useLocale as useIntlLocale } from "next-intl"

import { normalizeUiLocale } from "@/i18n/locales"
import { setClientLocale } from "@/i18n/changeLocale"
import { isRtlLocale, toAppLocale } from "@/lib/locale"

/** Keeps <html lang/dir> and persisted locale aligned with next-intl. */
export function useLocaleSync() {
  const locale = useIntlLocale()

  useEffect(() => {
    const raw = locale
    const normalized = normalizeUiLocale(raw)

    if (normalized !== raw && !raw.startsWith(normalized)) {
      setClientLocale(normalized)
      return
    }

    const html = document.documentElement
    html.setAttribute("lang", normalized)
    html.setAttribute("dir", isRtlLocale(normalized) ? "rtl" : "ltr")
    html.classList.remove("locale-en", "locale-fa")
    html.classList.add(toAppLocale(normalized) === "fa" ? "locale-fa" : "locale-en")
    localStorage.setItem("locale", normalized)
  }, [locale])
}
