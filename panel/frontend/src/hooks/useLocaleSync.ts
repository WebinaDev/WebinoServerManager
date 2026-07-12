"use client"

import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { normalizeUiLocale } from "@/i18n/locales"

function isRtlLocale(lng: string): boolean {
  return lng.startsWith("fa") || lng.startsWith("ar")
}

/** Keeps <html lang/dir> and persisted locale aligned with i18n. */
export function useLocaleSync() {
  const { i18n } = useTranslation()

  useEffect(() => {
    const raw = i18n.resolvedLanguage ?? i18n.language
    const normalized = normalizeUiLocale(raw)

    if (normalized !== raw && !raw.startsWith(normalized)) {
      void i18n.changeLanguage(normalized)
      return
    }

    const html = document.documentElement
    html.setAttribute("lang", normalized)
    html.setAttribute("dir", isRtlLocale(normalized) ? "rtl" : "ltr")
    localStorage.setItem("locale", normalized)
  }, [i18n, i18n.language, i18n.resolvedLanguage])
}
