import { ReactNode } from "react"

interface KPICardProps {
  title: string
  value: number
  icon: ReactNode
  color: string
  selected?: boolean
  onClick?: () => void
}

export function KPICard({ title, value, icon, color, selected = false, onClick }: KPICardProps) {
  return (
    <div 
      onClick={onClick}
      className={`
        cursor-pointer transition-all duration-200 p-4 rounded-lg border
        ${selected 
          ? 'bg-[#1B1B1B] border-[#F1C40F] shadow-lg' 
          : 'bg-[#1B1B1B] border-[#2C2C2C] hover:border-[#404040]'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20`, color: color }}
          >
            {icon}
          </div>
          <div>
            <p className="text-sm text-[#A7A7A7]">{title}</p>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        </div>
      </div>
    </div>
  )
}