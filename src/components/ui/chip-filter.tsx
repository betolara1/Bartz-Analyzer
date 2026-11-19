import * as React from "react"
import { cn } from "./utils"

type FilterTag = "all" | "ok" | "erro" | "muxarabi" | "coringa" | "ferragens" | "precoZero" | "qtdZero"

interface ChipFilterProps {
  label: string
  tag: FilterTag
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}

const iconMap: Record<FilterTag, string> = {
  all: "⎯",
  ok: "✓", 
  erro: "✕",
  muxarabi: "🧩",
  coringa: "🎨",
  ferragens: "🛠️",
  precoZero: "💲",
  qtdZero: "#️⃣"
}

const iconColorMap: Record<FilterTag, string> = {
  all: "currentColor",
  ok: "#27AE60",
  erro: "#E74C3C", 
  muxarabi: "currentColor",
  coringa: "currentColor",
  ferragens: "currentColor",
  precoZero: "currentColor",
  qtdZero: "currentColor"
}

const ChipFilter = React.forwardRef<HTMLButtonElement, ChipFilterProps>(
  ({ label, tag, selected = false, disabled = false, onClick, className, ...props }, ref) => {
    const icon = iconMap[tag]
    const iconColor = iconColorMap[tag]
    
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          // Base styles
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200",
          "text-sm font-medium leading-none",
          "min-h-[36px]", // Accessibility minimum touch target
          
          // Default state
          "bg-[#1C1F26] border-[#2A2F3A] text-[#EAECEF]",
          
          // Hover state (when not selected and not disabled)
          !selected && !disabled && "hover:bg-[#232834]",
          
          // Selected state
          selected && "bg-[#111111] border-[#F1C40F] text-[#F1C40F]",
          
          // Disabled state
          disabled && "opacity-40 cursor-not-allowed",
          
          // Focus state
          "focus:outline-none focus:ring-2 focus:ring-[#F1C40F] focus:ring-offset-2 focus:ring-offset-[#111111]",
          
          className
        )}
        {...props}
      >
        {icon && (
          <span 
            className="text-sm leading-none"
            style={{ 
              color: selected ? "#F1C40F" : iconColor === "currentColor" ? "currentColor" : iconColor 
            }}
          >
            {icon}
          </span>
        )}
        <span className="whitespace-nowrap">{label}</span>
      </button>
    )
  }
)

ChipFilter.displayName = "ChipFilter"

export { ChipFilter, type FilterTag, type ChipFilterProps }