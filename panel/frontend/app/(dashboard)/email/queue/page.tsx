import { createPage } from "@/lib/create-page"

const MailQueuePage = createPage(() => import("@/views/MailQueuePage"))

export default function Page() {
  return <MailQueuePage />
}
