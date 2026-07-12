import { createPage } from "@/lib/create-page"

const GitPage = createPage(() => import("@/views/GitPage"))

export default function Page() {
  return <GitPage />
}
