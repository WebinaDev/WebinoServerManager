import { EnsureSetupComplete } from "@/components/EnsureSetupComplete"
import { DashboardPrefetch } from "@/components/DashboardPrefetch"
import DashboardLayoutPage from "@/views/DashboardLayoutPage"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EnsureSetupComplete>
      <DashboardPrefetch />
      <DashboardLayoutPage>{children}</DashboardLayoutPage>
    </EnsureSetupComplete>
  )
}
