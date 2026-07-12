import { createPage } from "@/lib/create-page"

const EmailAccountsPage = createPage(() => import("@/views/EmailAccountsPage"))

export default function Page() {
  return <EmailAccountsPage />
}
