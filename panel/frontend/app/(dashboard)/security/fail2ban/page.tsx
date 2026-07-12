import { createPage } from "@/lib/create-page"

const Fail2banPage = createPage(() => import("@/views/Fail2banPage"))

export default function Page() {
  return <Fail2banPage />
}
