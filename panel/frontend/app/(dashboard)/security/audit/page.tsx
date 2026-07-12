import { createPage } from "@/lib/create-page"

const AuditLogPage = createPage(() => import("@/views/AuditLogPage"))

export default function Page() {
  return <AuditLogPage />
}
