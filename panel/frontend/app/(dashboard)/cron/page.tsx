import { createPage } from "@/lib/create-page"

const CronPage = createPage(() => import("@/views/CronPage"))

export default function Page() {
  return <CronPage />
}
