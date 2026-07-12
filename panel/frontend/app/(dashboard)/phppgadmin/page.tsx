import { createPage } from "@/lib/create-page"

const PhpPgAdminPage = createPage(() => import("@/views/PhpPgAdminPage"))

export default function Page() {
  return <PhpPgAdminPage />
}
