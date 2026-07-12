import { createPage } from "@/lib/create-page"

const ClamAvScanPage = createPage(() => import("@/views/ClamAvScanPage"))

export default function Page() {
  return <ClamAvScanPage />
}
