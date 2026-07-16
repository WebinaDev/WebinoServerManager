import { useTranslations } from "next-intl"
import {
  Activity,
  Bell,
  Container,
  Database,
  FileText,
  Globe,
  HardDrive,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Mail,
  Server,
  Settings,
  Shield,
  Terminal,
  User,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react"
import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import type { NavMainItem } from "@/components/sidebar-07/nav-main"
import { api } from "@/lib/api"

export type NavSection = {
  groupLabel: string
  items: NavMainItem[]
}

const ICONS: Record<string, LucideIcon> = {
  domains: Globe,
  subdomains: Globe,
  dns: Globe,
  "webserver-vhosts": Server,
  apps: Container,
  "monitoring-services": Activity,
  "monitoring-logs": FileText,
  "monitoring-uptime": HeartPulse,
  "monitoring-channels": Bell,
  ssl: Shield,
  ftp: HardDrive,
  databases: Database,
  phpmyadmin: Database,
  phppgadmin: Database,
  php: Settings,
  webmail: Mail,
  "email-accounts": Mail,
  "email-forwarders": Mail,
  files: HardDrive,
  terminal: Terminal,
  cron: Settings,
  backups: HardDrive,
  "system-info": Server,
  "metrics-alerts": Server,
  users: Settings,
  sites: Server,
  products: Server,
  git: Settings,
  wordpress: Globe,
  support: Mail,
  "hosting-plans": Server,
  "hosting-accounts": Users,
  "api-tokens": KeyRound,
  webhooks: Webhook,
  profile: User,
  dashboard: LayoutDashboard,
}

type NavApiSection = {
  id: string
  label_key: string
  items: { slug: string; path: string; label_key: string }[]
}

function pathActive(pathname: string, path: string): boolean {
  if (path === "/") {
    return pathname === "/" || pathname === ""
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function useDashboardNav() {
  const t = useTranslations("nav")
  const pathname = usePathname() ?? ""

  const { data } = useQuery({
    queryKey: ["navigation"],
    queryFn: () => api<{ sections: NavApiSection[] }>("/api/v1/navigation"),
  })

  const navSections: NavSection[] = useMemo(() => {
    const sections = data?.sections ?? []
    const out: NavSection[] = [
      {
        groupLabel: t("section_overview"),
        items: [
          {
            title: t("dashboard"),
            url: "/",
            icon: LayoutDashboard,
            isActive: pathActive(pathname, "/"),
          },
        ],
      },
    ]

    for (const sec of sections) {
      const items: NavMainItem[] = sec.items.map((item) => ({
        title: t(item.label_key as never),
        url: item.path,
        icon: ICONS[item.slug] ?? Settings,
        isActive: pathActive(pathname, item.path),
      }))
      if (items.length) {
        out.push({
          groupLabel: t(sec.label_key as never),
          items,
        })
      }
    }

    return out
  }, [data, pathname, t])

  return { navSections }
}
