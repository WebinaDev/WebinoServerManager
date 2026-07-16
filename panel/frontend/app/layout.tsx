import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { NextIntlClientProvider } from "next-intl"

import { defaultLocale, isLocale, type Locale } from "../i18n"
import { yekanBakh } from "@/lib/fonts/yekan-bakh"
import { getApiOrigin } from "@/lib/api-origin"
import { AppProviders } from "@/providers/AppProviders"
import { QueryProvider } from "@/providers/QueryProvider"

import "./globals.css"

export const metadata: Metadata = {
  title: "Webino Server Manager",
  description: "Web hosting and server management panel",
  icons: {
    icon: [{ url: "/brand/favicon.png", type: "image/png" }],
    apple: "/brand/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

async function resolveLocale(): Promise<Locale> {
  const jar = await cookies()
  const value = jar.get("NEXT_LOCALE")?.value ?? jar.get("locale")?.value
  return value && isLocale(value) ? value : defaultLocale
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await resolveLocale()
  const messages = (await import(`../messages/${locale}.json`)).default
  const dir = locale === "fa" ? "rtl" : "ltr"
  const origin = getApiOrigin()

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      {origin ? (
        <head>
          <link rel="preconnect" href={origin} />
          <link rel="dns-prefetch" href={origin} />
        </head>
      ) : null}
      <body className={`${yekanBakh.variable} min-h-svh font-sans`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <AppProviders>{children}</AppProviders>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
