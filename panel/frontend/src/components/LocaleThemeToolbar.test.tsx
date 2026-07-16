import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { PUBLIC_UI_LOCALES } from "@/i18n/locales"

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}:${key}`,
  useLocale: () => "en",
}))

vi.mock("@/i18n/changeLocale", () => ({
  useChangeLocale: () => vi.fn(),
}))

vi.mock("@/providers/AppProviders", () => ({
  useThemeSettings: () => ({
    mode: "light",
    setMode: vi.fn(),
    accent: "zinc",
    setAccent: vi.fn(),
  }),
}))

describe("LocaleThemeToolbar", () => {
  it("renders only public locales en and fa", async () => {
    const { LocaleThemeToolbar } = await import("@/components/LocaleThemeToolbar")
    render(<LocaleThemeToolbar />)

    expect(PUBLIC_UI_LOCALES).toEqual(["en", "fa"])
    expect(screen.getByLabelText("common:a11y_choose_locale")).toBeInTheDocument()
    expect(screen.getByText("common:locale_en")).toBeInTheDocument()
    expect(screen.queryByText("common:locale_ar")).not.toBeInTheDocument()
    expect(PUBLIC_UI_LOCALES).toEqual(["en", "fa"])
  })
})
