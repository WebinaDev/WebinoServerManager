import { createPage } from "@/lib/create-page"

const FilesPage = createPage(() => import("@/views/FilesPage"))

export default function Page() {
  return <FilesPage />
}
