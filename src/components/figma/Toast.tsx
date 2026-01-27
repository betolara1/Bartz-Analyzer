import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react"
import { cn } from "../ui/utils"

interface ToastProps {
  variant: 'Success' | 'Warning' | 'Error' | 'Info'
  message: string
  className?: string
}

const toastConfig = {
  Success: {
    icon: <CheckCircle className="h-4 w-4" />,
    className: 'bg-[#27AE60]/10 border-[#27AE60]/20 text-[#27AE60]'
  },
  Warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    className: 'bg-[#F39C12]/10 border-[#F39C12]/20 text-[#F39C12]'
  },
  Error: {
    icon: <XCircle className="h-4 w-4" />,
    className: 'bg-[#E74C3C]/10 border-[#E74C3C]/20 text-[#E74C3C]'
  },
  Info: {
    icon: <Info className="h-4 w-4" />,
    className: 'bg-[#3498DB]/10 border-[#3498DB]/20 text-[#3498DB]'
  }
}

export function Toast({ variant, message, className }: ToastProps) {
  const config = toastConfig[variant]
  
  return (
    <div className={cn(
      "flex items-center gap-3 p-4 rounded-lg border max-w-md",
      config.className,
      className
    )}>
      {config.icon}
      <span className="text-sm">{message}</span>
    </div>
  )
}

// Componentes específicos para Figma
export const ToastSuccess = () => <Toast variant="Success" message="Monitoramento iniciado." />
export const ToastWarning = () => <Toast variant="Warning" message="Auto-fix aplicado: QTD 0→1, PREÇO 0.00→0.10." />
export const ToastError = () => <Toast variant="Error" message="Erro ao processar arquivo." />
export const ToastInfo = () => <Toast variant="Info" message="Pedido apenas de ferragens — validações de máquina ignoradas." />