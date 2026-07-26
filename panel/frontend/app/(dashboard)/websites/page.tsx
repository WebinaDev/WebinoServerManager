import { createPage } from "@/lib/create-page"

const WebsitesPage = createPage(() => import("@/views/WebsitesPage"))

export default function Page() {
  return <WebsitesPage />
}
