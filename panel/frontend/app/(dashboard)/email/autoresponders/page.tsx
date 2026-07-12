import { createPage } from "@/lib/create-page"

const AutorespondersPage = createPage(() => import("@/views/AutorespondersPage"))

export default function Page() {
  return <AutorespondersPage />
}
