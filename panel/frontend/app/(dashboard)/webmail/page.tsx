import { createPage } from "@/lib/create-page"

const WebmailPage = createPage(() => import("@/views/WebmailPage"))

export default function Page() {
  return <WebmailPage />
}
