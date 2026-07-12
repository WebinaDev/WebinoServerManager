"use client"

import { useTranslation } from "react-i18next"

type SkipLinkProps = {
  href: string
  labelKey?: "common:a11y_skip_to_main" | "common:a11y_skip_to_login" | "common:a11y_skip_to_setup"
}

export function SkipLink({
  href,
  labelKey = "common:a11y_skip_to_main",
}: SkipLinkProps) {
  const { t } = useTranslation(["common"])

  return (
    <a
      href={href}
      className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:outline-none focus:ring-2"
    >
      {t(labelKey)}
    </a>
  )
}
