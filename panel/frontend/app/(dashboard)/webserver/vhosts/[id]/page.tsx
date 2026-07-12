import { createPage } from "@/lib/create-page"

const VhostEditorPage = createPage(() => import("@/views/VhostEditorPage"))

export default function Page() {
  return <VhostEditorPage />
}
