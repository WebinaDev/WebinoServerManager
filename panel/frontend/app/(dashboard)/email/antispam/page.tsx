import { createPage } from "@/lib/create-page"

const AntispamPage = createPage(() => import("@/views/AntispamPage"))

export default function Page() {
  return <AntispamPage />
}
