import { createPage } from "@/lib/create-page"

const SecurityRisksPage = createPage(() => import("@/views/SecurityRisksPage"))

export default function Page() {
  return <SecurityRisksPage />
}
