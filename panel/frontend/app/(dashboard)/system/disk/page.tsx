import { createPage } from "@/lib/create-page"

const SystemDiskPage = createPage(() => import("@/views/SystemDiskPage"))

export default function Page() {
  return <SystemDiskPage />
}
