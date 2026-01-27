import { cn } from "../ui/utils"

interface ChipStatusProps {
  variant: 'OK' | 'ERRO' | 'FERRAGENS'
  className?: string
}

export function ChipStatus({ variant, className }: ChipStatusProps) {
  const getStatusStyles = (variant: string) => {
    switch (variant) {
      case 'OK':
        return 'bg-[#27AE60] text-white'
      case 'ERRO':
        return 'bg-[#E74C3C] text-white'
      case 'FERRAGENS':
        return 'bg-[#F39C12] text-white'
      default:
        return 'bg-[#3498DB] text-white'
    }
  }

  const getStatusText = (variant: string) => {
    switch (variant) {
      case 'FERRAGENS':
        return 'FERRAGENS-ONLY'
      default:
        return variant
    }
  }

  return (
    <span 
      className={cn(
        "inline-flex items-center px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
        getStatusStyles(variant),
        className
      )}
    >
      {getStatusText(variant)}
    </span>
  )
}

// Componentes específicos para Figma
export const ChipStatusOK = () => <ChipStatus variant="OK" />
export const ChipStatusERRO = () => <ChipStatus variant="ERRO" />
export const ChipStatusFERRAGENS = () => <ChipStatus variant="FERRAGENS" />