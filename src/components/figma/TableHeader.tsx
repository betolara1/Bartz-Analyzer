import { TableHead, TableHeader, TableRow } from "../ui/table"

export function TableHeaderComponent() {
  return (
    <TableHeader>
      <TableRow className="border-[#2C2C2C] hover:bg-[#2C2C2C]/50">
        <TableHead className="text-[#A7A7A7]">Arquivo</TableHead>
        <TableHead className="text-[#A7A7A7]">Status</TableHead>
        <TableHead className="text-[#A7A7A7]">Erros</TableHead>
        <TableHead className="text-[#A7A7A7]">Auto-fix</TableHead>
        <TableHead className="text-[#A7A7A7]">Avisos</TableHead>
        <TableHead className="text-[#A7A7A7]">Data/Hora</TableHead>
        <TableHead className="text-[#A7A7A7]">Ações</TableHead>
      </TableRow>
    </TableHeader>
  )
}