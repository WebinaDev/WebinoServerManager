import { redirect } from "next/navigation"

export default function Legacy403Page() {
  redirect("/forbidden")
}
