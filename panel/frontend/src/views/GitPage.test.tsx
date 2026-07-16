import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}:${key}`,
  useLocale: () => "en",
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { repositories: [] }, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}))

describe("GitPage", () => {
  it("renders title", async () => {
    const { default: GitPage } = await import("@/views/GitPage")
    render(<GitPage />)
    expect(screen.getByText("git:title")).toBeInTheDocument()
  })
})
