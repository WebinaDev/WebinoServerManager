"use client"

/**
 * LocaleDatePicker — `fa`: Jalali; `en`: shadcn Calendar (date-only).
 * With `includeTime`, always uses react-multi-date-picker.
 * Always stores ISO Gregorian strings.
 */
import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { CalendarIcon } from "lucide-react"
import gregorian from "react-date-object/calendars/gregorian"
import persian from "react-date-object/calendars/persian"
import persianFa from "react-date-object/locales/persian_fa"
import DateObject from "react-date-object"
import type { ChangedValue } from "react-multi-date-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useLocale } from "@/hooks/useLocale"
import { getCalendarConfig, formatDate } from "@/lib/locale"
import { cn } from "@/lib/utils"

const MultiDatePicker = dynamic(() => import("react-multi-date-picker"), {
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
  const t = useTranslations("common")
  const { dir, lang } = useLocale()
  const isFa = lang.startsWith("fa")
  const useMulti = includeTime || isFa
  const { calendar, locale } = useMemo(() => getCalendarConfig(lang), [lang])
  const [open, setOpen] = useState(false)

  const pickerValue = useMemo(() => {
    if (!value || value.trim() === "") return undefined
    try {
      return new DateObject(value)
    } catch {
      return undefined
    }
  }, [value])

  const resolvedPlaceholder = placeholder ?? t("datePicker_placeholder")

  if (useMulti) {
    return (
      <div className={cn("w-full sm:max-w-xs", className)} dir={dir}>
        <MultiDatePicker
          calendar={isFa ? persian : calendar}
          locale={isFa ? persianFa : locale}
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
          placeholder={resolvedPlaceholder}
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

  const date = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : undefined

  return (
    <div className={cn("w-full sm:max-w-xs", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              "w-full justify-start text-start font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="me-2 size-4" />
            {value ? formatDate(value.slice(0, 10), { lang: "en" }) : resolvedPlaceholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(d.toISOString().slice(0, 10))
                setOpen(false)
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
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
      onChange={(v) => onChange(v ? new Date(`${v}T00:00:00`) : null)}
      className={className}
      aria-label={ariaLabel}
    />
  )
}
