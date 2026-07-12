import { createPage } from "@/lib/create-page"

const TwoFactorSettingsPage = createPage(() => import("@/views/TwoFactorSettingsPage"))

export default function Page() {
  return <TwoFactorSettingsPage />
}
