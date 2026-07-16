"use client"

import { useTranslations } from "next-intl"

type SkipLinkProps = {
  href: string
  labelKey?: "a11y_skip_to_main" | "a11y_skip_to_login" | "a11y_skip_to_setup"
}

export function SkipLink({
  href,
  labelKey = "a11y_skip_to_main",
}: SkipLinkProps) {
  const t = useTranslations("common")

  return (
    <a
      href={href}
      className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:outline-none focus:ring-2"
    >
      {t(labelKey)}
    </a>
  )
}
