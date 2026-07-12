import { createPage } from "@/lib/create-page"

const UsersPage = createPage(() => import("@/views/UsersPage"))

export default function Page() {
  return <UsersPage />
}
