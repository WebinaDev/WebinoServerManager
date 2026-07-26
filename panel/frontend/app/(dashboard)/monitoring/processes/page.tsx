import { createPage } from "@/lib/create-page"

const ProcessesPage = createPage(() => import("@/views/ProcessesPage"))

export default ProcessesPage
