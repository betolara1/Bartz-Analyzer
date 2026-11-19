import { Card } from "./ui/card"
import { Progress } from "./ui/progress"
import { Badge } from "./ui/badge"
import { 
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  Zap,
  AlertTriangle
} from "lucide-react"

interface ProcessingStatsProps {
  isProcessing: boolean
  totalProcessed: number
  successCount: number
  errorCount: number
  ferragensCount: number
  recentFiles: Array<{
    filename: string
    status: 'ok' | 'erro' | 'FERRAGENS-ONLY'
    autoFix: string[]
    timestamp: string
  }>
}

export function ProcessingStats({ 
  isProcessing, 
  totalProcessed, 
  successCount, 
  errorCount, 
  ferragensCount,
  recentFiles 
}: ProcessingStatsProps) {
  const successRate = totalProcessed > 0 ? (successCount / totalProcessed * 100) : 0
  const errorRate = totalProcessed > 0 ? (errorCount / totalProcessed * 100) : 0
  const ferragensRate = totalProcessed > 0 ? (ferragensCount / totalProcessed * 100) : 0

  return (
    <div className="space-y-4 mb-6">
      {/* Status do processamento */}
      <Card className="p-4 bg-[#1B1B1B] border-[#2C2C2C]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#F1C40F]" />
            <h3 className="font-medium">Status do Processamento</h3>
          </div>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <>
                <div className="w-2 h-2 bg-[#27AE60] rounded-full animate-pulse"></div>
                <span className="text-[#27AE60] text-sm">Processando...</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{totalProcessed}</div>
            <div className="text-sm text-[#A7A7A7]">Total Processados</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-[#27AE60]">{successCount}</div>
            <div className="text-sm text-[#A7A7A7]">Sucessos</div>
            <div className="text-xs text-[#27AE60]">{successRate.toFixed(1)}%</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-[#E74C3C]">{errorCount}</div>
            <div className="text-sm text-[#A7A7A7]">Erros</div>
            <div className="text-xs text-[#E74C3C]">{errorRate.toFixed(1)}%</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-[#F39C12]">{ferragensCount}</div>
            <div className="text-sm text-[#A7A7A7]">Ferragens-only</div>
            <div className="text-xs text-[#F39C12]">{ferragensRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Barra de progresso visual */}
        {totalProcessed > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-[#A7A7A7]">
              <span>Distribuição de resultados</span>
              <span>{totalProcessed} arquivos</span>
            </div>
            <div className="w-full bg-[#2C2C2C] rounded-full h-2 overflow-hidden">
              <div className="h-full flex">
                <div 
                  className="bg-[#27AE60]" 
                  style={{ width: `${successRate}%` }}
                ></div>
                <div 
                  className="bg-[#E74C3C]" 
                  style={{ width: `${errorRate}%` }}
                ></div>
                <div 
                  className="bg-[#F39C12]" 
                  style={{ width: `${ferragensRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Arquivos recentes */}
      {recentFiles.length > 0 && (
        <Card className="p-4 bg-[#1B1B1B] border-[#2C2C2C]">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-[#F1C40F]" />
            <h3 className="font-medium">Processados Recentemente</h3>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentFiles.slice(-5).reverse().map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-[#2C2C2C]/30 rounded">
                <div className="flex items-center gap-3">
                  {file.status === 'ok' && <CheckCircle2 className="h-4 w-4 text-[#27AE60]" />}
                  {file.status === 'erro' && <XCircle className="h-4 w-4 text-[#E74C3C]" />}
                  {file.status === 'FERRAGENS-ONLY' && <Package className="h-4 w-4 text-[#F39C12]" />}
                  
                  <div>
                    <div className="text-sm font-mono">{file.filename}</div>
                    <div className="text-xs text-[#A7A7A7]">{file.timestamp}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {file.autoFix.length > 0 && (
                    <Badge className="bg-[#1ABC9C]/10 text-[#1ABC9C] border-[#1ABC9C]/20 text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      Auto-fix
                    </Badge>
                  )}
                  
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      file.status === 'ok' 
                        ? 'text-[#27AE60] border-[#27AE60]/20' 
                        : file.status === 'erro'
                        ? 'text-[#E74C3C] border-[#E74C3C]/20'
                        : 'text-[#F39C12] border-[#F39C12]/20'
                    }`}
                  >
                    {file.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}