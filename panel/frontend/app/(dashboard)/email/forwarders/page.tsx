import { createPage } from "@/lib/create-page"

const EmailForwardersPage = createPage(() => import("@/views/EmailForwardersPage"))

export default function Page() {
  return <EmailForwardersPage />
}
