import { createPage } from "@/lib/create-page"

const SubdomainsPage = createPage(() => import("@/views/SubdomainsPage"))

export default function Page() {
  return <SubdomainsPage />
}
