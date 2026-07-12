"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

export default function ForbiddenPage() {
  const { t } = useTranslation(["common"])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("common:forbidden_title")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {t("common:forbidden_message")}
      </p>
      <Button asChild variant="outline">
        <Link href="/">{t("common:back")}</Link>
      </Button>
    </div>
  )
}
