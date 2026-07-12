import { createPage } from "@/lib/create-page"

const SslPage = createPage(() => import("@/views/SslPage"))

export default function Page() {
  return <SslPage />
}
