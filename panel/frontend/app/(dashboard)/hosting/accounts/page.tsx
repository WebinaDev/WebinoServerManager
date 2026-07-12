import { createPage } from "@/lib/create-page"

const HostingAccountsPage = createPage(() => import("@/views/HostingAccountsPage"))

export default function Page() {
  return <HostingAccountsPage />
}
