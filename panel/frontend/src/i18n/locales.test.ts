import { describe, expect, it } from "vitest"

import {
  AR_LOCALE_ENABLED,
  normalizeUiLocale,
  PUBLIC_UI_LOCALES,
} from "./locales"

describe("locales", () => {
  it("excludes ar from public UI locales when disabled", () => {
    expect(AR_LOCALE_ENABLED).toBe(false)
    expect(PUBLIC_UI_LOCALES).not.toContain("ar")
    expect(PUBLIC_UI_LOCALES).toEqual(["en", "fa"])
  })

  it("normalizes ar to en when ar locale is disabled", () => {
    expect(normalizeUiLocale("ar")).toBe("en")
    expect(normalizeUiLocale("ar-SA")).toBe("en")
  })

  it("preserves fa and en", () => {
    expect(normalizeUiLocale("fa")).toBe("fa")
    expect(normalizeUiLocale("fa-IR")).toBe("fa")
    expect(normalizeUiLocale("en")).toBe("en")
    expect(normalizeUiLocale("en-US")).toBe("en")
  })
})
