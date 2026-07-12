import { createPage } from "@/lib/create-page"

const FirewallPage = createPage(() => import("@/views/FirewallPage"))

export default function Page() {
  return <FirewallPage />
}
