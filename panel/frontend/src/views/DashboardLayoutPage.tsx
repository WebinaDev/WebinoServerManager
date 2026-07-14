"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { ReactNode } from "react"

import { AppSidebar } from "@/components/sidebar-07/app-sidebar"
import { LocaleThemeToolbar } from "@/components/LocaleThemeToolbar"
import { OnboardingTour } from "@/components/OnboardingTour"
import { SkipLink } from "@/components/SkipLink"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { api } from "@/lib/api"
import { normalizeUiLocale } from "@/i18n/locales"
import { useDashboardNav } from "@/hooks/useDashboardNav"
import { useLocale } from "@/hooks/useLocale"
import { useLocaleSync } from "@/hooks/useLocaleSync"
import { RequirePermission } from "@/hooks/usePermissions"

type UserDto = {
  id: number
  name: string
  email: string
  timezone?: string
  locale?: string | null
  permissions?: { name: string }[]
}

export default function DashboardLayoutPage({
  children,
}: {
  children: ReactNode
}) {
  const { t, i18n } = useTranslation(["nav", "dashboard", "sidebar", "common"])
  const { dir } = useLocale()
  const { navSections } = useDashboardNav()
  const syncedUserLocale = useRef(false)

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api<UserDto>("/api/v1/auth/user"),
  })

  useLocaleSync()

  useEffect(() => {
    if (!user?.locale || syncedUserLocale.current) {
      return
    }
    const preferred = normalizeUiLocale(user.locale)
    const current = normalizeUiLocale(i18n.resolvedLanguage ?? i18n.language)
    if (preferred !== current) {
      void i18n.changeLanguage(preferred)
    }
    syncedUserLocale.current = true
  }, [user?.locale, i18n])

  const tenantLabel = user?.name ?? "…"
  const sidebarSide = dir === "rtl" ? "right" : "left"

  return (
    <RequirePermission>
      <SidebarProvider>
        <SkipLink href="#main-content" />
        <OnboardingTour />
        <AppSidebar
          side={sidebarSide}
          navSections={navSections}
          projects={[]}
          projectsGroupLabel={t("nav:projects")}
          user={{
            name: user?.name ?? "…",
            email: user?.email ?? "…",
          }}
          tenantLabel={tenantLabel}
          tenantPlanLabel={t("sidebar:plan_tenant")}
        />
        <SidebarInset dir={dir}>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex flex-1 items-center gap-2 px-4">
              <SidebarTrigger
                className="-ms-1"
                aria-label={t("sidebar:a11y_toggle")}
              />
              <Separator orientation="vertical" className="me-2 h-4" />
              <Breadcrumb aria-label={t("common:a11y_breadcrumb")}>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">
                      {t("dashboard:breadcrumb_building")}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {t("dashboard:breadcrumb_current")}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ms-auto" data-tour="locale-toolbar">
                <LocaleThemeToolbar />
              </div>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-1 flex-col gap-4 p-4 pt-0 outline-none"
          >
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RequirePermission>
  )
}
