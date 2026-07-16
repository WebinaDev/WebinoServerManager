"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("common")

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">{t("error_title")}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{error.message}</p>
      <button
        type="button"
        className="border-input rounded-md border px-4 py-2 text-sm"
        onClick={() => reset()}
      >
        {t("try_again")}
      </button>
    </div>
  )
}
