import { createPage } from "@/lib/create-page"

const DatabasesPage = createPage(() => import("@/views/DatabasesPage"))

export default function Page() {
  return <DatabasesPage />
}
