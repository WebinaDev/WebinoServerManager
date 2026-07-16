"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function ForbiddenPage() {
  const t = useTranslations("common")

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("forbidden_title")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {t("forbidden_message")}
      </p>
      <Button asChild variant="outline">
        <Link href="/">{t("back")}</Link>
      </Button>
    </div>
  )
}
