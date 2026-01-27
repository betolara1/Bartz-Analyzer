import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Table, TableBody } from "../ui/table"
import { CardKPI } from "./CardKPI"
import { ChipStatus } from "./ChipStatus"
import { BadgeErro } from "./BadgeErro"
import { AutoFixBadge } from "../AutoFixBadge"
import { Badge } from "../ui/badge"
import { TableHeaderComponent } from "./TableHeader"
import { 
  Play, 
  RotateCcw, 
  RefreshCw, 
  Settings,
  Calendar,
  Eye,
  FolderOpen
} from "lucide-react"

// Mock data expandido com mais exemplos
const mockFiles = [
  {
    filename: "PEDIDO_12345_ONLY_FERRAGENS.xml",
    status: "FERRAGENS" as const,
    errors: [] as const,
    autoFixes: ["QTD 0→1"],
    warnings: ["⚠️"],
    timestamp: "2024-01-15 14:30:25"
  },
  {
    filename: "PEDIDO_67890_SO_MAQUINAS.xml", 
    status: "OK" as const,
    errors: [] as const,
    autoFixes: [],
    warnings: [],
    timestamp: "2024-01-15 14:28:12"
  },
  {
    filename: "PEDIDO_11111_TESTE_SO_MUXARABI.xml",
    status: "ERRO" as const,
    errors: ["PecaMuxarabi", "ItemSemPreco"] as const,
    autoFixes: [],
    warnings: [],
    timestamp: "2024-01-15 14:25:08"
  },
  {
    filename: "PEDIDO_55555_MULTIPLOS_ERROS.xml",
    status: "ERRO" as const,
    errors: ["ItemSemCodigo", "ItemSemQuantidade", "Maquina2530Ausente", "Programa2534NaoGerado", "CadastroCorCoringa"] as const,
    autoFixes: ["QTD 0→1", "PREÇO 0.00→0.10"],
    warnings: [],
    timestamp: "2024-01-15 14:20:15"
  },
  {
    filename: "PEDIDO_77777_CORRIGIDO_AUTOFIX.xml",
    status: "OK" as const,
    errors: [] as const,
    autoFixes: ["QTD 0→1", "PREÇO 0.00→0.10"],
    warnings: [],
    timestamp: "2024-01-15 14:15:42"
  }
]

interface EnhancedDashboardProps {
  onNavigateToConfig: () => void
  showState?: 'normal' | 'loading' | 'empty'
}

export function EnhancedDashboard({ onNavigateToConfig, showState = 'normal' }: EnhancedDashboardProps) {
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [statusFilter, setStatusFilter] = useState("todos")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredFiles = mockFiles.filter(file => {
    const matchesStatus = statusFilter === "todos" || 
      (statusFilter === "ferragens-only" && file.status === "FERRAGENS") ||
      file.status.toLowerCase() === statusFilter
    const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const displayFiles = showState === 'empty' ? [] : filteredFiles

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Header */}
      <div className="border-b border-[#2C2C2C] bg-[#1B1B1B] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-[#F1C40F] rounded flex items-center justify-center text-black font-medium">
              B
            </div>
            <h1 className="text-xl font-medium">Bartz Verificador XML</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              className={`gap-2 ${isMonitoring ? 'bg-[#E74C3C] hover:bg-[#E74C3C]/90' : 'bg-[#27AE60] hover:bg-[#27AE60]/90'} text-white`}
            >
              <Play className="h-4 w-4" />
              {isMonitoring ? "⏸️ Pausar monitoramento" : "▶️ Iniciar monitoramento"}
            </Button>
            <Button variant="outline" className="gap-2 border-[#2C2C2C] hover:bg-[#2C2C2C]">
              <RotateCcw className="h-4 w-4" />
              🔄 Reanalisar tudo
            </Button>
            <Button variant="outline" className="gap-2 border-[#2C2C2C] hover:bg-[#2C2C2C]">
              <RefreshCw className="h-4 w-4" />
              🔁 Reanalisar só erros
            </Button>
            <Button variant="ghost" onClick={onNavigateToConfig} className="gap-2">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <CardKPI variant="Recebidos" value={156} />
          <CardKPI variant="Corretos" value={142} />
          <CardKPI variant="Inconformidades" value={12} />
          <CardKPI variant="Ferragens" value={2} />
        </div>

        {/* Filtros */}
        <div className="flex gap-4 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-[#1B1B1B] border-[#2C2C2C]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1B1B1B] border-[#2C2C2C]">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
              <SelectItem value="ferragens-only">Ferragens-only</SelectItem>
            </SelectContent>
          </Select>
          
          <Input
            placeholder="Buscar por nome do arquivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm bg-[#1B1B1B] border-[#2C2C2C]"
          />

          <div className="flex items-center gap-2 text-[#A7A7A7]">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Últimas 24h</span>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg">
          <Table>
            <TableHeaderComponent />
            <TableBody>
              {showState === 'loading' ? (
                <tr className="border-[#2C2C2C] hover:bg-[#2C2C2C]/30">
                  <td colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-[#A7A7A7]">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#A7A7A7] border-t-transparent" />
                      Processando arquivos...
                    </div>
                  </td>
                </tr>
              ) : showState === 'empty' || displayFiles.length === 0 ? (
                <tr className="border-[#2C2C2C]">
                  <td colSpan={7} className="text-center py-8 text-[#A7A7A7]">
                    Nenhum arquivo processado ainda
                  </td>
                </tr>
              ) : (
                displayFiles.map((file, index) => (
                  <tr key={index} className="border-[#2C2C2C] hover:bg-[#2C2C2C]/30">
                    <td className="font-mono text-sm p-4">{file.filename}</td>
                    <td className="p-4">
                      <ChipStatus variant={file.status} />
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {file.errors.map((error, idx) => (
                          <BadgeErro key={idx} type={error} />
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {file.autoFixes.map((fix, idx) => (
                          <AutoFixBadge key={idx} fix={fix} />
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      {file.warnings.map((warning, idx) => (
                        <Badge key={idx} variant="outline" className="text-[#F39C12] border-[#F39C12]/20 bg-[#F39C12]/10">
                          {warning}
                        </Badge>
                      ))}
                    </td>
                    <td className="text-[#A7A7A7] text-sm p-4">{file.timestamp}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}