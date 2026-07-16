"use client"

import { useTranslations, useLocale } from "next-intl"
import { useChangeLocale } from "@/i18n/changeLocale"
import { Languages, Moon, Sun } from "lucide-react"

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
  const t = useTranslations("common")
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const { mode, setMode, accent, setAccent } = useThemeSettings()

  const lng = normalizeUiLocale(locale)
  const accents: Accent[] = ["zinc", "slate", "blue", "green", "rose", "orange"]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t("a11y_choose_locale")}
          >
            <Languages className="size-4" />
            {t(localeLabelKey(lng))}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t("a11y_choose_accent")}
          >
            {t(`accent_${accent}` as never)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {accents.map((a) => (
            <DropdownMenuItem key={a} onClick={() => setAccent(a)}>
              {t(`accent_${a}` as never)}
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
          mode === "dark" ? t("theme_light") : t("theme_dark")
        }
      >
        {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  )
}
