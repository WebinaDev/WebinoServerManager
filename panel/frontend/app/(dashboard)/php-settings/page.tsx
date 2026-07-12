import { createPage } from "@/lib/create-page"

const PhpPage = createPage(() => import("@/views/PhpPage"))

export default function Page() {
  return <PhpPage />
}
