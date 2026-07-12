import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/domains",
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { domains: [{ id: 1, domain: "example.com", slug: null, status: "active" }] },
    isLoading: false,
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/hooks/usePermissions", () => ({
  RequireRouteWrite: () => null,
  usePermissions: () => ({
    can: () => false,
    permissions: new Set(),
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}))

describe("DomainsPage", () => {
  it("hides add button without write permission", async () => {
    const { default: DomainsPage } = await import("@/views/DomainsPage")
    render(<DomainsPage />)
    expect(screen.queryByText("domains:add")).not.toBeInTheDocument()
    expect(screen.getByText("example.com")).toBeInTheDocument()
  })
})
