import { createPage } from "@/lib/create-page"

const DomainsPage = createPage(() => import("@/views/DomainsPage"))

export default function Page() {
  return <DomainsPage />
}
