import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react"

import {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_STEPS,
} from "@/hooks/useOnboardingTour"

const storage = new Map<string, string>()

beforeEach(() => {
  vi.resetModules()
  storage.clear()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  })
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
})

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}:${key}`,
  useLocale: () => "en",
}))

describe("OnboardingTour", () => {
  it("shows welcome step when not dismissed", async () => {
    const { OnboardingTour } = await import("@/components/OnboardingTour")
    render(<OnboardingTour />)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
    expect(screen.getByText(`onboarding:${ONBOARDING_STEPS[0].titleKey}`)).toBeInTheDocument()
  })

  it("dismisses tour and persists to localStorage", async () => {
    const { OnboardingTour } = await import("@/components/OnboardingTour")
    render(<OnboardingTour />)

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("onboarding:skip"))

    expect(storage.get(ONBOARDING_STORAGE_KEY)).toBe("dismissed")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("does not render when already dismissed", async () => {
    storage.set(ONBOARDING_STORAGE_KEY, "dismissed")

    const { OnboardingTour } = await import("@/components/OnboardingTour")
    render(<OnboardingTour />)

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
