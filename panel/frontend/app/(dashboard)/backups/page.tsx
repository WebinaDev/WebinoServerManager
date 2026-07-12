import { createPage } from "@/lib/create-page"

const BackupsPage = createPage(() => import("@/views/BackupsPage"))

export default function Page() {
  return <BackupsPage />
}
