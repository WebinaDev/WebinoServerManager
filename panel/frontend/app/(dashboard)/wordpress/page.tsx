import { createPage } from "@/lib/create-page"

const WordpressPage = createPage(() => import("@/views/WordpressPage"))

export default function Page() {
  return <WordpressPage />
}
