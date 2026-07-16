"use client"

import { useEffect, useState } from "react"
import { NextIntlClientProvider, useTranslations } from "next-intl"

import en from "../messages/en.json"
import fa from "../messages/fa.json"

function GlobalErrorBody({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("common")

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h2>{t("error_title")}</h2>
      <p>{error.message || t("error_generic")}</p>
      <button type="button" onClick={() => reset()}>
        {t("try_again")}
      </button>
    </div>
  )
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState<"en" | "fa">("fa")

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
    const value = match?.[1]
    if (value === "en" || value === "fa") {
      setLocale(value)
    }
  }, [])

  const messages = locale === "en" ? en : fa
  const dir = locale === "fa" ? "rtl" : "ltr"

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <GlobalErrorBody error={error} reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
