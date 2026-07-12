import React from "react"
import { RedocStandalone } from "redoc"

export default function ApiDoc() {
  return <RedocStandalone specUrl="/openapi.json" />
}
