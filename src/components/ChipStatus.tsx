import { cn } from "./ui/utils"
import { Status } from "../types"

interface ChipStatusProps {
  variant?: Status
  status?: Status // Alias for backward compatibility
  className?: string
}

export function ChipStatus({ variant, status, className }: ChipStatusProps) {
  const v = variant || status || "-" as Status
  
  const getStatusConfig = (v: Status) => {
    switch (v) {
      case 'OK':
        return {
          style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-emerald-500/5',
          dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
        }
      case 'ERRO':
        return {
          style: 'bg-rose-500/10 text-rose-400 border-rose-500/25 shadow-rose-500/5',
          dot: 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.6)] animate-pulse'
        }
      case 'FERRAGENS':
      case 'FERRAGENS-ONLY':
        return {
          style: 'bg-amber-500/10 text-amber-400 border-amber-500/25 shadow-amber-500/5',
          dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
        }
      default:
        return {
          style: 'bg-sky-500/10 text-sky-400 border-sky-500/25 shadow-sky-500/5',
          dot: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]'
        }
    }
  }

  const getStatusText = (v: Status) => {
    if (v === 'FERRAGENS') return 'FERRAGENS-ONLY'
    if (v === ("-" as Status)) return "-"
    return v
  }

  const config = getStatusConfig(v)

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border shadow-sm whitespace-nowrap transition-all",
        config.style,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
      {getStatusText(v)}
    </span>
  )
}

// Componentes específicos para compatibilidade
export const ChipStatusOK = () => <ChipStatus variant="OK" />
export const ChipStatusERRO = () => <ChipStatus variant="ERRO" />
export const ChipStatusFERRAGENS = () => <ChipStatus variant="FERRAGENS" />

