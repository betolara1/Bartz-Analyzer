import { TableCell, TableRow } from "../ui/table"
import { ChipStatus } from "./ChipStatus"
import { BadgeErro } from "./BadgeErro"
import { AutoFixBadge } from "../AutoFixBadge"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Eye, FolderOpen, RefreshCw } from "lucide-react"

interface TableRowProps {
  variant: 'Default' | 'Error' | 'FerragesOnly' | 'Loading' | 'Empty'
}

export function TableRowComponent({ variant }: TableRowProps) {
  if (variant === 'Loading') {
    return (
      <TableRow className="border-[#2C2C2C] hover:bg-[#2C2C2C]/30">
        <TableCell colSpan={7} className="text-center py-8">
          <div className="flex items-center justify-center gap-2 text-[#A7A7A7]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#A7A7A7] border-t-transparent" />
            Processando arquivos...
          </div>
        </TableCell>
      </TableRow>
    )
  }

  if (variant === 'Empty') {
    return (
      <TableRow className="border-[#2C2C2C]">
        <TableCell colSpan={7} className="text-center py-8 text-[#A7A7A7]">
          Nenhum arquivo processado ainda
        </TableCell>
      </TableRow>
    )
  }

  const rowData = {
    Default: {
      filename: "PEDIDO_67890_SO_MAQUINAS.xml",
      status: "OK" as const,
      errors: [],
      autoFixes: [],
      warnings: [],
      timestamp: "2024-01-15 14:28:12"
    },
    Error: {
      filename: "PEDIDO_11111_TESTE_SO_MUXARABI.xml", 
      status: "ERRO" as const,
      errors: ["PecaMuxarabi", "ItemSemPreco", "Maquina2530Ausente"] as const,
      autoFixes: [],
      warnings: [],
      timestamp: "2024-01-15 14:25:08"
    },
    FerragesOnly: {
      filename: "PEDIDO_12345_ONLY_FERRAGENS.xml",
      status: "FERRAGENS" as const,
      errors: [],
      autoFixes: ["QTD 0→1"],
      warnings: ["⚠️"],
      timestamp: "2024-01-15 14:30:25"
    }
  }

  const data = rowData[variant as keyof typeof rowData]

  return (
    <TableRow className="border-[#2C2C2C] hover:bg-[#2C2C2C]/30">
      <TableCell className="font-mono text-sm">{data.filename}</TableCell>
      <TableCell>
        <ChipStatus variant={data.status} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {data.errors.map((error, idx) => (
            <BadgeErro key={idx} type={error} />
          ))}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {data.autoFixes.map((fix, idx) => (
            <AutoFixBadge key={idx} fix={fix} />
          ))}
        </div>
      </TableCell>
      <TableCell>
        {data.warnings.map((warning, idx) => (
          <Badge key={idx} variant="outline" className="text-[#F39C12] border-[#F39C12]/20 bg-[#F39C12]/10">
            {warning}
          </Badge>
        ))}
      </TableCell>
      <TableCell className="text-[#A7A7A7] text-sm">{data.timestamp}</TableCell>
      <TableCell>
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
      </TableCell>
    </TableRow>
  )
}

// Componentes específicos para Figma
export const TableRowDefault = () => <TableRowComponent variant="Default" />
export const TableRowError = () => <TableRowComponent variant="Error" />
export const TableRowFerragesOnly = () => <TableRowComponent variant="FerragesOnly" />
export const TableRowLoading = () => <TableRowComponent variant="Loading" />
export const TableRowEmpty = () => <TableRowComponent variant="Empty" />