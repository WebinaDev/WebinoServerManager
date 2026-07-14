import type { Metadata, Viewport } from "next"

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-svh font-sans">
        <QueryProvider>
          <AppProviders>{children}</AppProviders>
        </QueryProvider>
      </body>
    </html>
  )
}
