"use client"

import { Languages, Moon, Sun } from "lucide-react"
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
import type { Accent } from "@/providers/AppProviders"
import { useThemeSettings } from "@/providers/AppProviders"

export function LocaleThemeToolbar() {
  const { i18n, t } = useTranslation()
  const { mode, setMode, accent, setAccent } = useThemeSettings()

  const lng = normalizeUiLocale(i18n.language)
  const accents: Accent[] = ["zinc", "slate", "blue", "green", "rose", "orange"]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t("common:a11y_choose_locale")}
          >
            <Languages className="size-4" />
            {t(localeLabelKey(lng))}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t("common:a11y_choose_accent")}
          >
            {t(`common:accent_${accent}` as never)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {accents.map((a) => (
            <DropdownMenuItem key={a} onClick={() => setAccent(a)}>
              {t(`common:accent_${a}` as never)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setMode(mode === "dark" ? "light" : "dark")}
        aria-label={
          mode === "dark" ? t("common:theme_light") : t("common:theme_dark")
        }
      >
        {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  )
}
