import * as React from "react"
import { safeLocalStorage } from "@/utils/safeStorage"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

const HIGH_CONTRAST_KEY = "vite-ui-high-contrast"
const LIGHT_THEME_COLOR = "#f5f7f3"
const DARK_THEME_COLOR = "#0a0b0a"

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    highContrast: boolean
    setHighContrast: (value: boolean) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    highContrast: false,
    setHighContrast: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

function getSystemTheme(): "dark" | "light" {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function isTheme(value: string | null): value is Theme {
    return value === "dark" || value === "light" || value === "system"
}

function applyResolvedTheme(resolvedTheme: "dark" | "light") {
    const root = window.document.documentElement
    const themeColor = window.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme
    themeColor?.setAttribute(
        "content",
        resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    )
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
    const [theme, setTheme] = React.useState<Theme>(() => {
        const storedTheme = safeLocalStorage.getItem(storageKey)
        return isTheme(storedTheme) ? storedTheme : defaultTheme
    })

    const [highContrast, setHighContrastState] = React.useState<boolean>(() =>
        safeLocalStorage.getItem(HIGH_CONTRAST_KEY) === "true"
    )

    React.useLayoutEffect(() => {
        const resolved = theme === "system" ? getSystemTheme() : theme
        applyResolvedTheme(resolved)
    }, [theme])

    React.useEffect(() => {
        const root = window.document.documentElement
        if (highContrast) root.classList.add("high-contrast")
        else root.classList.remove("high-contrast")
    }, [highContrast])

    React.useEffect(() => {
        if (theme === "system") {
            const mql = window.matchMedia("(prefers-color-scheme: dark)")
            const handler = () => {
                applyResolvedTheme(getSystemTheme())
            }
            mql.addEventListener("change", handler)
            return () => mql.removeEventListener("change", handler)
        }
    }, [theme])

    const value = React.useMemo(() => ({
        theme,
        setTheme: (t: Theme) => {
            safeLocalStorage.setItem(storageKey, t)
            setTheme(t)
        },
        highContrast,
        setHighContrast: (v: boolean) => {
            safeLocalStorage.setItem(HIGH_CONTRAST_KEY, v ? "true" : "false")
            setHighContrastState(v)
        },
    }), [theme, storageKey, highContrast])

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext)
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")
    return context
}
