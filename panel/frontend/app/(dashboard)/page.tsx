import DashboardHome from "@/views/DashboardHome"
import { apiServer } from "@/lib/api-server"

type Summary = {
  domains: number
  databases: number
  sites: number
  system_status: string
  cpu_percent?: number
  mem_percent?: number
  disk_percent?: number
}

export default async function HomePage() {
  const initialSummary = await apiServer<Summary>("/api/v1/dashboard/summary")

  return <DashboardHome initialSummary={initialSummary} />
}
