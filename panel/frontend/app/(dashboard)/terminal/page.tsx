import { createPage } from "@/lib/create-page"

const TerminalPage = createPage(() => import("@/views/TerminalPage"))

export default function Page() {
  return <TerminalPage />
}
