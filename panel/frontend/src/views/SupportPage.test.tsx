import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { tickets: [] }, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}))

describe("SupportPage", () => {
  it("renders title", async () => {
    const { default: SupportPage } = await import("@/views/SupportPage")
    render(<SupportPage />)
    expect(screen.getByText("support:title")).toBeInTheDocument()
  })
})
