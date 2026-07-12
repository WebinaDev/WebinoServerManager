import { createPage } from "@/lib/create-page"

const SupportPage = createPage(() => import("@/views/SupportPage"))

export default function Page() {
  return <SupportPage />
}
