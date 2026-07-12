import { createPage } from "@/lib/create-page"

const PhpMyAdminPage = createPage(() => import("@/views/PhpMyAdminPage"))

export default function Page() {
  return <PhpMyAdminPage />
}
