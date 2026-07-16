"use client"

import { useTranslations, useLocale } from "next-intl"
import { useChangeLocale } from "@/i18n/changeLocale"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useLocaleSync } from "@/hooks/useLocaleSync"
import {
  normalizeUiLocale,
  PUBLIC_UI_LOCALES,
  type PublicUiLocale,
} from "@/i18n/locales"

const TIMEZONES = [
  "UTC",
  "Asia/Tehran",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
]

type UserProfile = {
  id: number
  name: string
  email: string | null
  timezone?: string
  locale?: string | null
}

export default function ProfileSettingsPage() {
  const t = useTranslations("profile")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const qc = useQueryClient()
  useLocaleSync()

  const { data: user, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api<UserProfile>("/api/v1/auth/user"),
  })

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/auth/profile", { method: "PATCH", json: body }),
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ["auth-user"] })
      if (typeof variables.locale === "string") {
        changeLocale(variables.locale)
      }
    },
  })

  if (isLoading || !user) {
    return <p className="p-6">{tCommon("loading")}</p>
  }

  const profileLocale = normalizeUiLocale(user.locale ?? locale)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid max-w-lg gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              save.mutate({
                name: String(fd.get("name")),
                timezone: String(fd.get("timezone")),
                locale: String(fd.get("locale")),
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="profile-name">{t("field_name")}</Label>
              <Input id="profile-name" name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-timezone">{t("field_timezone")}</Label>
              <select
                id="profile-timezone"
                name="timezone"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                defaultValue={user.timezone ?? "UTC"}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-locale">{t("field_locale")}</Label>
              <select
                id="profile-locale"
                name="locale"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                defaultValue={profileLocale}
              >
                {PUBLIC_UI_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {t(`locale_${code}` as `locale_${PublicUiLocale}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={save.isPending}>
              {tCommon("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
