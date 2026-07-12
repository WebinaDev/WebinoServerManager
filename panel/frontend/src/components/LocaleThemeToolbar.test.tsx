import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { PUBLIC_UI_LOCALES } from "@/i18n/locales"

const changeLanguage = vi.fn()

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage },
  }),
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
    expect(screen.queryByText("common:locale_ar")).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("common:a11y_choose_locale"))
    expect(screen.getByText("common:locale_en")).toBeInTheDocument()
    expect(screen.getByText("common:locale_fa")).toBeInTheDocument()
    expect(screen.queryByText("common:locale_ar")).not.toBeInTheDocument()
  })
})
