import { createPage } from "@/lib/create-page"

const SitesPage = createPage(() => import("@/views/SitesPage"))

export default function Page() {
  return <SitesPage />
}
