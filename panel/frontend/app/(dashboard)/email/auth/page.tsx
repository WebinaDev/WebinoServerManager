import { createPage } from "@/lib/create-page"

const EmailAuthPage = createPage(() => import("@/views/EmailAuthPage"))

export default function Page() {
  return <EmailAuthPage />
}
