import { Card } from "../ui/card"
import { cn } from "../ui/utils"
import { FileText, CheckCircle, XCircle, Package } from "lucide-react"

interface CardKPIProps {
  variant: 'Recebidos' | 'Corretos' | 'Inconformidades' | 'Ferragens'
  value: number
  className?: string
}

const kpiConfig = {
  Recebidos: {
    title: 'Recebidos',
    icon: <FileText className="h-5 w-5" />,
    color: '#3498DB'
  },
  Corretos: {
    title: 'Corretos', 
    icon: <CheckCircle className="h-5 w-5" />,
    color: '#27AE60'
  },
  Inconformidades: {
    title: 'Inconformidades',
    icon: <XCircle className="h-5 w-5" />,
    color: '#E74C3C'
  },
  Ferragens: {
    title: 'Ferragens-only',
    icon: <Package className="h-5 w-5" />,
    color: '#F39C12'
  }
}

export function CardKPI({ variant, value, className }: CardKPIProps) {
  const config = kpiConfig[variant]
  
  return (
    <Card className={cn("p-4 bg-[#1B1B1B] border-[#2C2C2C]", className)}>
      <div className="flex items-center gap-3">
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${config.color}20`, color: config.color }}
        >
          {config.icon}
        </div>
        <div>
          <p className="text-[#A7A7A7] text-sm">{config.title}</p>
          <p className="text-white text-2xl font-medium">{value}</p>
        </div>
      </div>
    </Card>
  )
}

// Componentes específicos para Figma
export const CardKPIRecebidos = () => <CardKPI variant="Recebidos" value={156} />
export const CardKPICorretos = () => <CardKPI variant="Corretos" value={142} />
export const CardKPIInconformidades = () => <CardKPI variant="Inconformidades" value={12} />
export const CardKPIFerragens = () => <CardKPI variant="Ferragens" value={2} />