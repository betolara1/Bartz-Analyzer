import { cn } from "../ui/utils"

interface BadgeErroProps {
  type: 'ItemSemCodigo' | 'ItemSemQuantidade' | 'ItemSemPreco' | 'CadastroCorCoringa' | 'PecaMuxarabi' | 'Maquina2530Ausente' | 'Maquina2534Ausente' | 'Maquina2341Ausente' | 'Maquina2525Ausente' | 'Programa2530NaoGerado' | 'Programa2534NaoGerado' | 'Programa2341NaoGerado' | 'Programa2525NaoGerado'
  className?: string
}

const errorMessages = {
  ItemSemCodigo: 'ITEM SEM CÓDIGO',
  ItemSemQuantidade: 'ITEM SEM QUANTIDADE', 
  ItemSemPreco: 'ITEM SEM PREÇO',
  CadastroCorCoringa: 'CADASTRO DE COR CORINGA',
  PecaMuxarabi: 'PEÇA MUXARABI',
  Maquina2530Ausente: 'MAQUINA COM PLUGIN 2530 AUSENTE',
  Maquina2534Ausente: 'MAQUINA COM PLUGIN 2534 AUSENTE',
  Maquina2341Ausente: 'MAQUINA COM PLUGIN 2341 AUSENTE',
  Maquina2525Ausente: 'MAQUINA COM PLUGIN 2525 AUSENTE',
  Programa2530NaoGerado: 'PROGRAMA NÃO GERADO PARA PLUGIN 2530',
  Programa2534NaoGerado: 'PROGRAMA NÃO GERADO PARA PLUGIN 2534',
  Programa2341NaoGerado: 'PROGRAMA NÃO GERADO PARA PLUGIN 2341',
  Programa2525NaoGerado: 'PROGRAMA NÃO GERADO PARA PLUGIN 2525'
}

export function BadgeErro({ type, className }: BadgeErroProps) {
  return (
    <span 
      className={cn(
        "inline-flex items-center px-2 py-1 rounded text-xs bg-[#E74C3C]/10 text-[#E74C3C] border border-[#E74C3C]/20 whitespace-nowrap",
        className
      )}
    >
      {errorMessages[type]}
    </span>
  )
}

// Componentes específicos para Figma
export const BadgeErroItemSemCodigo = () => <BadgeErro type="ItemSemCodigo" />
export const BadgeErroItemSemQuantidade = () => <BadgeErro type="ItemSemQuantidade" />
export const BadgeErroItemSemPreco = () => <BadgeErro type="ItemSemPreco" />
export const BadgeErroCadastroCorCoringa = () => <BadgeErro type="CadastroCorCoringa" />
export const BadgeErroPecaMuxarabi = () => <BadgeErro type="PecaMuxarabi" />
export const BadgeErroMaquina2530Ausente = () => <BadgeErro type="Maquina2530Ausente" />
export const BadgeErroMaquina2534Ausente = () => <BadgeErro type="Maquina2534Ausente" />
export const BadgeErroMaquina2341Ausente = () => <BadgeErro type="Maquina2341Ausente" />
export const BadgeErroMaquina2525Ausente = () => <BadgeErro type="Maquina2525Ausente" />
export const BadgeErroPrograma2530NaoGerado = () => <BadgeErro type="Programa2530NaoGerado" />
export const BadgeErroPrograma2534NaoGerado = () => <BadgeErro type="Programa2534NaoGerado" />
export const BadgeErroPrograma2341NaoGerado = () => <BadgeErro type="Programa2341NaoGerado" />
export const BadgeErroPrograma2525NaoGerado = () => <BadgeErro type="Programa2525NaoGerado" />