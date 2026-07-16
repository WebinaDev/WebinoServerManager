"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import { LoginForm } from "@/components/login-04/login-form"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { SkipLink } from "@/components/SkipLink"
import { useLocaleSync } from "@/hooks/useLocaleSync"

export default function LoginPage() {
  const t = useTranslations("common")
  useLocaleSync()

  return (
    <>
      <SkipLink href="#login-form" labelKey="a11y_skip_to_login" />
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <Image
                src="/brand/logo.png"
                alt=""
                width={24}
                height={24}
                className="size-6 rounded-md"
                priority
              />
              {t("appName")}
            </div>
            <LocaleSwitcher />
          </div>
          <LoginForm />
        </div>
      </div>
    </>
  )
}
