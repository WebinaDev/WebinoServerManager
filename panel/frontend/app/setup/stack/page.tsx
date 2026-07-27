import { createPage } from "@/lib/create-page"

const SetupStackPage = createPage(() => import("@/views/SetupStackWizardPage"))

export default function SetupStackRoute() {
  return <SetupStackPage />
}
