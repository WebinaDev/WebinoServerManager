import { createPage } from "@/lib/create-page"

const WebsiteDetailPage = createPage(() => import("@/views/WebsiteDetailPage"))

export default function Page() {
  return <WebsiteDetailPage />
}
