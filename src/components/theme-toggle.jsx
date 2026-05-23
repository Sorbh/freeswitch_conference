import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      value={[theme]}
      onValueChange={(values) => {
        const next = values.find((v) => v !== theme)
        if (next) setTheme(next)
      }}
      spacing={0}
      size="sm"
      variant="outline"
      className={className}
    >
      <ToggleGroupItem value="system" aria-label="System theme">
        <MonitorIcon className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="light" aria-label="Light theme">
        <SunIcon className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark theme">
        <MoonIcon className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
