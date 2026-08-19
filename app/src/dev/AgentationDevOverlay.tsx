import * as React from "react"
import { Agentation } from "agentation"

/**
 * Dev-only UI annotation toolbar (Agentation).
 * https://www.agentation.com — not loaded in production builds.
 */
export const AgentationDevOverlay = (): React.ReactElement => (
  <Agentation className="z-[2147483646]" />
)
