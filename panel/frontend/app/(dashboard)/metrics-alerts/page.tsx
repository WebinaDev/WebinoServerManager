import { createPage } from "@/lib/create-page"

const MetricsAlertsPage = createPage(() => import("@/views/MetricsAlertsPage"))

export default function Page() {
  return <MetricsAlertsPage />
}
