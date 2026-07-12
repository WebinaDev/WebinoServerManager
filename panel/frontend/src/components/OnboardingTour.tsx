"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useOnboardingTour } from "@/hooks/useOnboardingTour"

function useTargetRect(target?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!target) {
      setRect(null)
      return
    }

    function update() {
      const el = document.querySelector(`[data-tour="${target}"]`)
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" })
        setRect(el.getBoundingClientRect())
      } else {
        setRect(null)
      }
    }

    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [target])

  return rect
}

export function OnboardingTour() {
  const { t } = useTranslation(["onboarding", "common"])
  const { active, step, isLast, next, skip } = useOnboardingTour()
  const dialogRef = useRef<HTMLDivElement>(null)
  const targetRect = useTargetRect(step?.target)

  useEffect(() => {
    if (active && dialogRef.current) {
      const firstButton = dialogRef.current.querySelector("button")
      firstButton?.focus()
    }
  }, [active, step?.id])

  if (!active || !step) {
    return null
  }

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const highlightStyle =
    targetRect && !reducedMotion
      ? {
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }
      : null

  const isCentered = !step.target

  return (
    <div className="fixed inset-0 z-[100]" aria-hidden={false}>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t("onboarding:skip")}
        onClick={skip}
        tabIndex={-1}
      />
      {highlightStyle ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
          style={highlightStyle}
        />
      ) : null}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
        className={
          isCentered
            ? "absolute inset-0 flex items-center justify-center p-4"
            : "absolute bottom-4 start-4 end-4 sm:start-auto sm:end-4 sm:max-w-sm"
        }
      >
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle id="onboarding-title">{t(step.titleKey as never)}</CardTitle>
            <CardDescription id="onboarding-body">
              {t(step.bodyKey as never)}
            </CardDescription>
          </CardHeader>
          <CardContent className="sr-only">
            {t(step.bodyKey as never)}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={skip}>
              {t("onboarding:skip")}
            </Button>
            <Button type="button" onClick={next}>
              {isLast ? t("onboarding:done") : t("onboarding:next")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
