import { createPage } from "@/lib/create-page"

const MailingListsPage = createPage(() => import("@/views/MailingListsPage"))

export default function Page() {
  return <MailingListsPage />
}
