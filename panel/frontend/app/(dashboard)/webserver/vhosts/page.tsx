import { createPage } from "@/lib/create-page"

const VhostsPage = createPage(() => import("@/views/VhostsPage"))

export default function Page() {
  return <VhostsPage />
}
