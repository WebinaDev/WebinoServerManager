"use client"

import { useTranslations, useLocale } from "next-intl"
import { useChangeLocale } from "@/i18n/changeLocale"
import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  localeLabelKey,
  normalizeUiLocale,
  PUBLIC_UI_LOCALES,
  type PublicUiLocale,
} from "@/i18n/locales"

type Props = {
  showTheme?: boolean
}

/** Compact locale switcher for auth pages; full toolbar in dashboard header. */
export function LocaleSwitcher({ showTheme: _showTheme }: Props = {}) {
  const t = useTranslations("common")
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const lng = normalizeUiLocale(locale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="ms-auto shrink-0"
          aria-label={t("a11y_choose_locale")}
        >
          <Languages className="size-4" />
          <span className="hidden sm:inline">{t(localeLabelKey(lng))}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PUBLIC_UI_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => changeLocale(code)}
          >
            {t(`locale_${code}` as `locale_${PublicUiLocale}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
