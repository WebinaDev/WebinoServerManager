import { createPage } from "@/lib/create-page"

const FtpPage = createPage(() => import("@/views/FtpPage"))

export default function Page() {
  return <FtpPage />
}
