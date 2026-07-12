import { createPage } from "@/lib/create-page"

const DnsPage = createPage(() => import("@/views/DnsPage"))

export default function Page() {
  return <DnsPage />
}
