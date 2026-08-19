import * as React from "react"
import { useLocation } from "react-router-dom"
import { addBreadcrumb } from "@/lib/observability/breadcrumbs"

/**
 * Records route changes (pathname only) for error correlation.
 */
export function NavigationBreadcrumbTracker(): null {
  const location = useLocation()

  React.useEffect(() => {
    addBreadcrumb("nav", `route:${location.pathname}`)
  }, [location.pathname])

  return null
}
