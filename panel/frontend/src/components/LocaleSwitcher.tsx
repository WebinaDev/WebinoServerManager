"use client"

import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

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
  const { i18n, t } = useTranslation()
  const lng = normalizeUiLocale(i18n.language)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="ms-auto shrink-0"
          aria-label={t("common:a11y_choose_locale")}
        >
          <Languages className="size-4" />
          <span className="hidden sm:inline">{t(localeLabelKey(lng))}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PUBLIC_UI_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => void i18n.changeLanguage(code)}
          >
            {t(`common:locale_${code}` as `common:locale_${PublicUiLocale}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
