import { createPage } from "@/lib/create-page"

const WafPage = createPage(() => import("@/views/WafPage"))

export default function Page() {
  return <WafPage />
}
