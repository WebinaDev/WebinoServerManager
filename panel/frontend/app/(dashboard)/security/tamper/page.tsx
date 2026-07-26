import { createPage } from "@/lib/create-page"

const SecurityTamperPage = createPage(() => import("@/views/SecurityTamperPage"))

export default function Page() {
  return <SecurityTamperPage />
}
