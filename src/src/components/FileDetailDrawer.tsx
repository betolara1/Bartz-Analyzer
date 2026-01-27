import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { StatusChip } from "./StatusChip"
import { ErrorBadge } from "./ErrorBadge"
import { AutoFixBadge } from "./AutoFixBadge"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ScrollArea } from "./ui/scroll-area"
import { Separator } from "./ui/separator"
import { 
  ExternalLink, 
  FileText, 
  FolderOpen, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Zap,
  Eye,
  Copy,
  Download
} from "lucide-react"
import { toast } from "sonner"

interface FileData {
  filename: string
  status: 'OK' | 'ERRO' | 'FERRAGENS-ONLY'
  errors: string[]
  autoFixes: string[]
  warnings: string[]
  timestamp: string
  tags: string[]
  paths: {
    origem: string
    working: string
    destino: string
    logs: string
  }
  logPreview: {
    status: string
    processedAt: string
    fase: string
    errors?: string[]
    autoFixes?: string[]
    warnings?: string[]
    tags: string[]
  }
}

interface FileDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  fileData?: FileData
}

// Função para formatar tags
const formatTag = (tag: string): string => {
  const tagMap: Record<string, string> = {
    'ferragens': 'FERRAGENS',
    'qtdZero': 'QTD ZERO',
    'precoZero': 'PREÇO ZERO',
    'muxarabi': 'MUXARABI',
    'coringa': 'COR CORINGA'
  }
  return tagMap[tag] || tag.toUpperCase()
}

// Função para copiar texto
const copyToClipboard = (text: string, description: string) => {
  navigator.clipboard.writeText(text).then(() => {
    toast("Copiado para área de transferência", {
      description: description
    })
  }).catch(() => {
    toast("Erro ao copiar", {
      description: "Não foi possível copiar o texto"
    })
  })
}

export function FileDetailDrawer({ isOpen, onClose, fileData }: FileDetailDrawerProps) {
  if (!fileData) return null

  // Simular log detalhado mais completo
  const detailedLog = {
    ...fileData.logPreview,
    metadata: {
      originalSize: "156.8 KB",
      processedSize: "158.2 KB",
      processingTime: "1.2s",
      xmlVersion: "1.0",
      encoding: "UTF-8",
      builderVersion: "v2.1.5"
    },
    validation: {
      itemsTotal: 12,
      itemsProcessed: 12,
      itemsWithErrors: fileData.errors.length,
      itemsAutoFixed: fileData.autoFixes.length
    },
    plugins: {
      required: ["2530", "2534", "2341", "2525"],
      found: fileData.status === "FERRAGENS-ONLY" ? [] : ["2530", "2534"],
      missing: fileData.status === "FERRAGENS-ONLY" ? [] : ["2341", "2525"]
    },
    analysis: {
      hasFerragens: fileData.tags.includes("ferragens"),
      hasMuxarabi: fileData.tags.includes("muxarabi"),
      hasCoringa: fileData.tags.includes("coringa"),
      hasQuantityIssues: fileData.tags.includes("qtdZero"),
      hasPriceIssues: fileData.tags.includes("precoZero")
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="bg-[#1B1B1B] border-[#2C2C2C] text-white w-[700px] max-w-[90vw] p-0">
        <div className="flex flex-col h-full">
          {/* Header fixo */}
          <div className="p-6 border-b border-[#2C2C2C]">
            <SheetHeader>
              <SheetTitle className="text-white flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#F1C40F]" />
                <span className="font-mono text-sm">{fileData.filename}</span>
                <StatusChip status={fileData.status} />
              </SheetTitle>
              <SheetDescription className="text-[#A7A7A7] mt-2">
                Detalhes completos do processamento XML • {fileData.timestamp}
              </SheetDescription>
              
              {/* Tags */}
              {fileData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {fileData.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-[#3498DB] border-[#3498DB]/20 bg-[#3498DB]/10 text-xs">
                      {formatTag(tag)}
                    </Badge>
                  ))}
                </div>
              )}
            </SheetHeader>
          </div>

          {/* Conteúdo com scroll */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <div className="border-b border-[#2C2C2C] px-6">
                <TabsList className="bg-transparent h-12 p-0 gap-6">
                  <TabsTrigger 
                    value="overview" 
                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-[#F1C40F] data-[state=active]:border-b-2 data-[state=active]:border-[#F1C40F] rounded-none"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Visão Geral
                  </TabsTrigger>
                  <TabsTrigger 
                    value="paths" 
                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-[#F1C40F] data-[state=active]:border-b-2 data-[state=active]:border-[#F1C40F] rounded-none"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Paths
                  </TabsTrigger>
                  <TabsTrigger 
                    value="log" 
                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-[#F1C40F] data-[state=active]:border-b-2 data-[state=active]:border-[#F1C40F] rounded-none"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Log JSON
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="overview" className="h-full mt-0">
                  <ScrollArea className="h-full px-6 py-4">
                    <div className="space-y-6">
                      {/* Status Summary */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#111111] p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-[#A7A7A7]" />
                            <span className="text-sm text-[#A7A7A7]">Processamento</span>
                          </div>
                          <div className="text-lg font-medium">{detailedLog.metadata.processingTime}</div>
                        </div>
                        
                        <div className="bg-[#111111] p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-[#A7A7A7]" />
                            <span className="text-sm text-[#A7A7A7]">Tamanho</span>
                          </div>
                          <div className="text-lg font-medium">{detailedLog.metadata.originalSize}</div>
                        </div>
                      </div>

                      {/* Validação */}
                      <div>
                        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-[#27AE60]" />
                          Validação
                        </h3>
                        <div className="bg-[#111111] p-4 rounded-lg space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-[#A7A7A7]">Itens processados:</span>
                            <span>{detailedLog.validation.itemsProcessed}/{detailedLog.validation.itemsTotal}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#A7A7A7]">Itens com erro:</span>
                            <span className={fileData.errors.length > 0 ? "text-[#E74C3C]" : "text-[#27AE60]"}>
                              {detailedLog.validation.itemsWithErrors}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#A7A7A7]">Auto-fix aplicados:</span>
                            <span className={fileData.autoFixes.length > 0 ? "text-[#F1C40F]" : "text-[#A7A7A7]"}>
                              {detailedLog.validation.itemsAutoFixed}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Erros */}
                      {fileData.errors.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-[#E74C3C]" />
                            Erros Encontrados ({fileData.errors.length})
                          </h3>
                          <div className="space-y-2">
                            {fileData.errors.map((error, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 bg-[#E74C3C]/10 border border-[#E74C3C]/20 rounded">
                                <XCircle className="h-4 w-4 text-[#E74C3C] flex-shrink-0" />
                                <span className="text-[#E74C3C] text-sm">{error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Auto-fix */}
                      {fileData.autoFixes.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                            <Zap className="h-5 w-5 text-[#F1C40F]" />
                            Correções Automáticas ({fileData.autoFixes.length})
                          </h3>
                          <div className="space-y-2">
                            {fileData.autoFixes.map((fix, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 bg-[#F1C40F]/10 border border-[#F1C40F]/20 rounded">
                                <Zap className="h-4 w-4 text-[#F1C40F] flex-shrink-0" />
                                <span className="text-[#F1C40F] text-sm font-mono">{fix}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Avisos */}
                      {fileData.warnings.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-[#F39C12]" />
                            Avisos ({fileData.warnings.length})
                          </h3>
                          <div className="space-y-2">
                            {fileData.warnings.map((warning, index) => (
                              <div key={index} className="p-3 bg-[#F39C12]/10 border border-[#F39C12]/20 rounded">
                                <div className="flex items-start gap-3">
                                  <AlertTriangle className="h-4 w-4 text-[#F39C12] flex-shrink-0 mt-0.5" />
                                  <span className="text-[#F39C12] text-sm">{warning}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Plugins */}
                      {fileData.status !== "FERRAGENS-ONLY" && (
                        <div>
                          <h3 className="text-lg font-medium mb-3">Plugins de Máquina</h3>
                          <div className="bg-[#111111] p-4 rounded-lg space-y-3">
                            <div>
                              <span className="text-[#A7A7A7] text-sm">Requeridos:</span>
                              <div className="flex gap-2 mt-1">
                                {detailedLog.plugins.required.map(plugin => (
                                  <Badge key={plugin} variant="outline" className="text-[#A7A7A7] border-[#A7A7A7]/20">
                                    {plugin}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-[#A7A7A7] text-sm">Encontrados:</span>
                              <div className="flex gap-2 mt-1">
                                {detailedLog.plugins.found.map(plugin => (
                                  <Badge key={plugin} variant="outline" className="text-[#27AE60] border-[#27AE60]/20 bg-[#27AE60]/10">
                                    {plugin}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {detailedLog.plugins.missing.length > 0 && (
                              <div>
                                <span className="text-[#A7A7A7] text-sm">Ausentes:</span>
                                <div className="flex gap-2 mt-1">
                                  {detailedLog.plugins.missing.map(plugin => (
                                    <Badge key={plugin} variant="outline" className="text-[#E74C3C] border-[#E74C3C]/20 bg-[#E74C3C]/10">
                                      {plugin}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="paths" className="h-full mt-0">
                  <ScrollArea className="h-full px-6 py-4">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Localização dos Arquivos</h3>
                      
                      {Object.entries(fileData.paths).map(([key, path]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[#A7A7A7] capitalize font-medium">{key}</span>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={() => copyToClipboard(path, `Path ${key} copiado`)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <code className="block bg-[#111111] p-3 rounded text-sm font-mono break-all border border-[#2C2C2C]">
                            {path}
                          </code>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="log" className="h-full mt-0">
                  <ScrollArea className="h-full px-6 py-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Log de Processamento</h3>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2"
                            onClick={() => copyToClipboard(JSON.stringify(detailedLog, null, 2), "Log JSON copiado")}
                          >
                            <Copy className="h-4 w-4" />
                            Copiar
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-[#111111] rounded-lg border border-[#2C2C2C] overflow-hidden">
                        <div className="p-3 border-b border-[#2C2C2C] bg-[#1B1B1B]">
                          <span className="text-sm text-[#A7A7A7] font-mono">JSON</span>
                        </div>
                        <pre className="p-4 text-xs font-mono overflow-x-auto max-h-96 text-[#A7A7A7]">
                          {JSON.stringify(detailedLog, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}