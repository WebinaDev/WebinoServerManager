import { createPage } from "@/lib/create-page"

const HostingPlansPage = createPage(() => import("@/views/HostingPlansPage"))

export default function Page() {
  return <HostingPlansPage />
}
