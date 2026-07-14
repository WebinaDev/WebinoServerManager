"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import gregorian from "react-date-object/calendars/gregorian"
import DateObject from "react-date-object"
import type { ChangedValue } from "react-multi-date-picker"

import { useLocale } from "@/hooks/useLocale"
import { getCalendarConfig } from "@/lib/locale"
import { cn } from "@/lib/utils"

const DatePicker = dynamic(() => import("react-multi-date-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-full animate-pulse rounded-md bg-muted sm:max-w-xs" />
  ),
})

type Props = {
  /** ISO date `YYYY-MM-DD` or ISO datetime string */
  value: string
  onChange: (isoValue: string) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  id?: string
  includeTime?: boolean
  "aria-label"?: string
}

const inputClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

/** Jalali picker for `fa`, Gregorian for `en`. Values stored as ISO Gregorian. */
export function LocaleDatePicker({
  value,
  onChange,
  disabled,
  required,
  placeholder,
  className,
  id,
  includeTime = false,
  "aria-label": ariaLabel,
}: Props) {
  const { t } = useTranslation(["common"])
  const { dir, lang } = useLocale()
  const { calendar, locale } = useMemo(() => getCalendarConfig(lang), [lang])

  const pickerValue = useMemo(() => {
    if (!value || value.trim() === "") {
      return undefined
    }
    try {
      return new DateObject(value)
    } catch {
      return undefined
    }
  }, [value])

  return (
    <div className={cn("w-full sm:max-w-xs", className)} dir={dir}>
      <DatePicker
        calendar={calendar}
        locale={locale}
        format={includeTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD"}
        value={pickerValue}
        onChange={(d: ChangedValue) => {
          if (d == null || Array.isArray(d)) {
            onChange("")
            return
          }
          const g = d.convert(gregorian)
          if (includeTime) {
            onChange(g.format("YYYY-MM-DD HH:mm:ss"))
          } else {
            onChange(g.format("YYYY-MM-DD"))
          }
        }}
        disabled={disabled}
        required={required}
        placeholder={placeholder ?? t("common:datePicker_placeholder")}
        inputClass={inputClassName}
        containerClassName="w-full"
        className="rmdp-theme-panel w-full"
        calendarPosition="bottom-start"
        id={id}
        aria-label={ariaLabel}
      />
    </div>
  )
}

/** Date-only picker backed by native Date (dashboard preview). */
export function LocaleDatePickerDate({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: Date | null
  onChange: (value: Date | null) => void
  className?: string
  "aria-label"?: string
}) {
  const iso = value ? value.toISOString().slice(0, 10) : ""
  return (
    <LocaleDatePicker
      value={iso}
      onChange={(v) => onChange(v ? new Date(v) : null)}
      className={className}
      aria-label={ariaLabel}
    />
  )
}
