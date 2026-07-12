import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { resources } from "./resources"

const defaultLocale =
  typeof window !== "undefined"
    ? (localStorage.getItem("locale") ?? "fa")
    : "fa"

void i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale,
  fallbackLng: "en",
  defaultNS: "common",
  ns: [
    "common",
    "auth",
    "nav",
    "dashboard",
    "settings",
    "setup",
    "sidebar",
    "domains",
    "subdomains",
    "databases",
    "dns",
    "webserver",
    "ssl",
    "ftp",
    "php",
    "email",
    "security",
    "files",
    "cron",
    "backups",
    "metrics",
    "users",
    "system",
    "terminal",
    "git",
    "wordpress",
    "support",
    "phpmyadmin",
    "phppgadmin",
    "webmail",
    "sites",
    "products",
    "hosting",
    "apps",
    "monitoring",
    "tokens",
    "webhooks",
    "profile",
    "onboarding",
  ],
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
