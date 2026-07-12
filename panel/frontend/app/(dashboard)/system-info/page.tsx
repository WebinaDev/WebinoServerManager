import { createPage } from "@/lib/create-page"

const SystemInfoPage = createPage(() => import("@/views/SystemInfoPage"))

export default function Page() {
  return <SystemInfoPage />
}
