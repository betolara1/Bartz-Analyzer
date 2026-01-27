import { Card } from "../ui/card"
import { Separator } from "../ui/separator"
import { Table, TableBody } from "../ui/table"

// Importar todos os componentes específicos
import { 
  ChipStatusOK, 
  ChipStatusERRO, 
  ChipStatusFERRAGENS 
} from "./ChipStatus"

import { 
  BadgeErroItemSemCodigo,
  BadgeErroItemSemQuantidade, 
  BadgeErroItemSemPreco,
  BadgeErroCadastroCorCoringa,
  BadgeErroPecaMuxarabi,
  BadgeErroMaquina2530Ausente,
  BadgeErroMaquina2534Ausente,
  BadgeErroPrograma2530NaoGerado,
  BadgeErroPrograma2534NaoGerado
} from "./BadgeErro"

import {
  CardKPIRecebidos,
  CardKPICorretos, 
  CardKPIInconformidades,
  CardKPIFerragens
} from "./CardKPI"

import {
  ToastSuccess,
  ToastWarning,
  ToastError,
  ToastInfo
} from "./Toast"

import {
  TableRowDefault,
  TableRowError,
  TableRowFerragesOnly,
  TableRowLoading,
  TableRowEmpty
} from "./TableRow"

import { TableHeaderComponent } from "./TableHeader"
import { Button } from "../ui/button"
import { Play, RotateCcw, RefreshCw } from "lucide-react"

export function ComponentLibrary() {
  return (
    <div className="min-h-screen bg-[#111111] text-white p-8 space-y-8">
      <h1 className="text-3xl font-medium text-center mb-12">Bartz Analyzer - Biblioteca de Componentes</h1>

      {/* Chips de Status */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Chip/Status</h2>
        <div className="flex gap-4">
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Chip/Status/OK</p>
            <ChipStatusOK />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Chip/Status/ERRO</p>
            <ChipStatusERRO />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Chip/Status/FERRAGENS</p>
            <ChipStatusFERRAGENS />
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Badges de Erro */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Badge/Erro</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/ItemSemCodigo</p>
            <BadgeErroItemSemCodigo />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/ItemSemQuantidade</p>
            <BadgeErroItemSemQuantidade />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/ItemSemPreco</p>
            <BadgeErroItemSemPreco />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/CadastroCorCoringa</p>
            <BadgeErroCadastroCorCoringa />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/PecaMuxarabi</p>
            <BadgeErroPecaMuxarabi />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/Maquina2530Ausente</p>
            <BadgeErroMaquina2530Ausente />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/Maquina2534Ausente</p>
            <BadgeErroMaquina2534Ausente />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/Programa2530NaoGerado</p>
            <BadgeErroPrograma2530NaoGerado />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Badge/Erro/Programa2534NaoGerado</p>
            <BadgeErroPrograma2534NaoGerado />
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Cards KPI */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Card/KPI</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Card/KPI/Recebidos</p>
            <CardKPIRecebidos />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Card/KPI/Corretos</p>
            <CardKPICorretos />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Card/KPI/Inconformidades</p>
            <CardKPIInconformidades />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Card/KPI/Ferragens</p>
            <CardKPIFerragens />
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Toasts */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Toast</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Toast/Success</p>
            <ToastSuccess />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Toast/Warning</p>
            <ToastWarning />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Toast/Error</p>
            <ToastError />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Toast/Info</p>
            <ToastInfo />
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Botões */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Botões</h2>
        <div className="flex gap-4">
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Primário</p>
            <Button className="bg-[#F1C40F] text-black hover:bg-[#F1C40F]/90 gap-2">
              <Play className="h-4 w-4" />
              ▶️ Iniciar monitoramento
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Secundário</p>
            <Button variant="outline" className="border-[#2C2C2C] hover:bg-[#2C2C2C] gap-2">
              <RotateCcw className="h-4 w-4" />
              🔄 Reanalisar tudo
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#A7A7A7]">Terciário</p>
            <Button variant="ghost" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              🔁 Reanalisar só erros
            </Button>
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Tabela */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Tabela</h2>
        <div className="bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg">
          <Table>
            <TableHeaderComponent />
            <TableBody>
              <TableRowDefault />
              <TableRowError />
              <TableRowFerragesOnly />
              <TableRowLoading />
              <TableRowEmpty />
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}