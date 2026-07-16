"use client"

import { useCallback, useEffect, useState } from "react"

export const ONBOARDING_STORAGE_KEY = "webino_onboarding_v1"

export type OnboardingStep = {
  id: string
  titleKey: string
  bodyKey: string
  target?: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    titleKey: "welcome_title",
    bodyKey: "welcome_body",
  },
  {
    id: "nav",
    titleKey: "nav_title",
    bodyKey: "nav_body",
    target: "sidebar-nav",
  },
  {
    id: "locale",
    titleKey: "locale_title",
    bodyKey: "locale_body",
    target: "locale-toolbar",
  },
  {
    id: "profile",
    titleKey: "profile_title",
    bodyKey: "profile_body",
    target: "nav-user",
  },
  {
    id: "done",
    titleKey: "done_title",
    bodyKey: "done_body",
  },
]

function isDismissed(): boolean {
  if (typeof window === "undefined") {
    return true
  }
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "dismissed"
}

export function useOnboardingTour() {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!isDismissed()) {
      setActive(true)
    }
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "dismissed")
    setActive(false)
  }, [])

  const next = useCallback(() => {
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      dismiss()
      return
    }
    setStepIndex((i) => i + 1)
  }, [dismiss, stepIndex])

  const skip = dismiss

  const step = ONBOARDING_STEPS[stepIndex]
  const isLast = stepIndex >= ONBOARDING_STEPS.length - 1

  return {
    active,
    step,
    stepIndex,
    isLast,
    next,
    skip,
    dismiss,
  }
}
