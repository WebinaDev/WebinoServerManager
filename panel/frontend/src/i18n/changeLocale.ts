"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"

import { isRtlLocale, toAppLocale } from "@/lib/locale"

export function setClientLocale(lng: string) {
  document.cookie = `NEXT_LOCALE=${lng};path=/;max-age=31536000`
  localStorage.setItem("locale", lng)
  const html = document.documentElement
  html.lang = lng
  html.dir = isRtlLocale(lng) ? "rtl" : "ltr"
  html.classList.remove("locale-en", "locale-fa")
  html.classList.add(toAppLocale(lng) === "fa" ? "locale-fa" : "locale-en")
}

export function useChangeLocale() {
  const router = useRouter()

  return useCallback(
    (lng: string) => {
      setClientLocale(lng)
      router.refresh()
    },
    [router],
  )
}
