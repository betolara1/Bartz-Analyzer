import * as React from "react"
import { cn } from "./utils"
import { ChipFilter, type FilterTag } from "./chip-filter"

interface FilterBarProps {
  selectedTag?: FilterTag
  onTagChange?: (tag: FilterTag) => void
  className?: string
}

const filterItems = [
  { label: "Todos", tag: "all" as FilterTag },
  { label: "Corretos", tag: "ok" as FilterTag },
  { label: "Inconformidades", tag: "erro" as FilterTag },
  { label: "Muxarabi", tag: "muxarabi" as FilterTag },
  { label: "Cor Coringa", tag: "coringa" as FilterTag },
  { label: "Só Ferragens", tag: "ferragens" as FilterTag },
  { label: "Preço 0.00", tag: "precoZero" as FilterTag },
  { label: "Qtd 0", tag: "qtdZero" as FilterTag },
]

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  ({ selectedTag = "all", onTagChange, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center gap-2 py-2 bg-[#111111]",
          className
        )}
        {...props}
      >
        {filterItems.map(({ label, tag }) => (
          <ChipFilter
            key={tag}
            label={label}
            tag={tag}
            selected={selectedTag === tag}
            onClick={() => onTagChange?.(tag)}
          />
        ))}
      </div>
    )
  }
)

FilterBar.displayName = "FilterBar"

export { FilterBar, type FilterBarProps }