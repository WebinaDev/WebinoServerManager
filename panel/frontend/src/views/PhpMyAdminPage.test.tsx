import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}))

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue({ databases: [] }),
}))

describe("PhpMyAdminPage", () => {
  it("renders title", async () => {
    const { default: PhpMyAdminPage } = await import("@/views/PhpMyAdminPage")
    render(<PhpMyAdminPage />)
    expect(screen.getByText("phpmyadmin:title")).toBeInTheDocument()
  })
})
