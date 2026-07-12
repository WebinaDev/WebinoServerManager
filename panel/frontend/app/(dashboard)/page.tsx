import { createPage } from "@/lib/create-page"

const DashboardHome = createPage(() => import("@/views/DashboardHome"))

export default function HomePage() {
  return <DashboardHome />
}
