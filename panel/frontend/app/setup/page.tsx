import { createPage } from "@/lib/create-page"

const SetupWizardPage = createPage(() => import("@/views/SetupWizardPage"))

export default function SetupPage() {
  return <SetupWizardPage />
}
