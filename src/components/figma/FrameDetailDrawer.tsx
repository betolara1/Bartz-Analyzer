import { FileDetailDrawer } from "../FileDetailDrawer"

const mockFileData = {
  filename: "PEDIDO_11111_TESTE_SO_MUXARABI.xml",
  status: "ERRO" as const,
  errors: ["PEÇA MUXARABI", "ITEM SEM PREÇO", "MAQUINA COM PLUGIN 2530 AUSENTE"],
  autoFixes: ["QTD 0→1"],
  warnings: [],
  timestamp: "2024-01-15 14:25:08",
  paths: {
    origem: "\\\\server\\entrada\\PEDIDO_11111_TESTE_SO_MUXARABI.xml",
    working: "\\\\server\\working\\PEDIDO_11111_TESTE_SO_MUXARABI.xml", 
    destino: "\\\\server\\XML_FINAL\\erro\\PEDIDO_11111_TESTE_SO_MUXARABI.xml",
    logs: "\\\\server\\LOGS\\errors\\PEDIDO_11111_TESTE_SO_MUXARABI.json"
  },
  logPreview: {
    status: "ERRO",
    processedAt: "2024-01-15T14:25:08Z",
    errors: ["PEÇA MUXARABI", "ITEM SEM PREÇO", "MAQUINA COM PLUGIN 2530 AUSENTE"],
    autoFixes: ["QTD 0→1"],
    validations: {
      plugins: {
        required: [2530, 2534, 2341, 2525],
        missing: [2530],
        programsGenerated: [2534, 2341, 2525]
      },
      items: {
        total: 15,
        withErrors: 3,
        muxarabiItems: ["MX6001", "MX6005"]
      }
    }
  }
}

export function FrameDetailDrawer() {
  return (
    <div 
      className="w-[600px] h-[800px] bg-[#111111] border border-[#2C2C2C] overflow-hidden"
    >
      <div className="relative h-full">
        <FileDetailDrawer
          isOpen={true}
          onClose={() => {}}
          fileData={mockFileData}
        />
      </div>
    </div>
  )
}