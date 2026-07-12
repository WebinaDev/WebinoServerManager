import { createPage } from "@/lib/create-page"

const ForbiddenPage = createPage(() => import("@/views/ForbiddenPage"))

export default ForbiddenPage
