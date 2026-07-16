"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

import { normalizeUiLocale } from "@/i18n/locales"
import { AppToaster } from "@/components/ui/sonner"
import { isRtlLocale, toAppLocale } from "@/lib/locale"

export type Accent =
  | "zinc"
  | "slate"
  | "blue"
  | "green"
  | "rose"
  | "orange"

type ThemeMode = "light" | "dark"

type ThemeCtx = {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  accent: Accent
  setAccent: (a: Accent) => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

export function useThemeSettings() {
  const v = useContext(ThemeContext)
  if (!v) {
    throw new Error("ThemeContext missing")
  }
  return v
}

type AuthCtx = {
  /** @deprecated Session auth uses HttpOnly cookie only. */
  setToken: (t: string | null) => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) {
    throw new Error("AuthContext missing")
  }
  return v
}

function readStoredLocale(): string {
  if (typeof window === "undefined") {
    return "fa"
  }
  return localStorage.getItem("locale") ?? "fa"
}

function AccentAndAuthProviders({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [hydrated, setHydrated] = useState(false)
  const [accent, setAccent] = useState<Accent>("zinc")

  const setToken = useCallback((_t: string | null) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
    }
  }, [])

  const setMode = useCallback(
    (m: ThemeMode) => {
      setTheme(m)
      localStorage.setItem("theme_mode", m)
    },
    [setTheme],
  )

  useLayoutEffect(() => {
    localStorage.removeItem("auth_token")
    const storedAccent = localStorage.getItem("theme_accent") as Accent | null
    if (
      storedAccent &&
      ["zinc", "slate", "blue", "green", "rose", "orange"].includes(storedAccent)
    ) {
      setAccent(storedAccent)
    }
    const locale = readStoredLocale()
    const normalized = normalizeUiLocale(locale)
    if (normalized !== locale) {
      localStorage.setItem("locale", normalized)
      document.cookie = `NEXT_LOCALE=${normalized};path=/;max-age=31536000`
    }
    document.documentElement.lang = normalized
    document.documentElement.dir = isRtlLocale(normalized) ? "rtl" : "ltr"
    document.documentElement.classList.remove("locale-en", "locale-fa")
    document.documentElement.classList.add(
      toAppLocale(normalized) === "fa" ? "locale-fa" : "locale-en",
    )
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    localStorage.setItem("theme_accent", accent)
    document.documentElement.setAttribute("data-accent", accent)
    document.body.className =
      "min-h-svh bg-background text-foreground font-sans antialiased"
  }, [hydrated, accent])

  const mode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light"

  const themeValue = useMemo(
    () => ({
      mode,
      setMode,
      accent,
      setAccent,
    }),
    [mode, setMode, accent],
  )

  const authValue = useMemo(() => ({ setToken }), [setToken])

  if (!hydrated) {
    return null
  }

  return (
    <AuthContext.Provider value={authValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
        <AppToaster />
      </ThemeContext.Provider>
    </AuthContext.Provider>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="theme_mode"
    >
      <AccentAndAuthProviders>{children}</AccentAndAuthProviders>
    </NextThemesProvider>
  )
}
