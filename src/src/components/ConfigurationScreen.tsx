import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Separator } from "./ui/separator"
import { Badge } from "./ui/badge"
import { 
  Settings, 
  FolderOpen, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Info,
  AlertTriangle
} from "lucide-react"
import { toast } from "sonner"

export function ConfigurationScreen() {
  const [paths, setPaths] = useState({
    entrada: "\\\\server\\ENTRADA_XML",
    working: "\\\\server\\WORKING",
    destino: "\\\\server\\XML_FINAL",
    logs: "\\\\server\\LOGS"
  })

  const [pathStatus, setPathStatus] = useState<Record<string, 'checking' | 'valid' | 'invalid'>>({})

  const handlePathChange = (key: string, value: string) => {
    setPaths(prev => ({ ...prev, [key]: value }))
    // Reset status quando path muda
    setPathStatus(prev => ({ ...prev, [key]: 'checking' }))
  }

  const validatePath = async (key: string, path: string) => {
    setPathStatus(prev => ({ ...prev, [key]: 'checking' }))
    
    // Simular validação de path (em produção seria via IPC)
    setTimeout(() => {
      const isValid = path.includes('\\\\server\\') && path.length > 10
      setPathStatus(prev => ({ 
        ...prev, 
        [key]: isValid ? 'valid' : 'invalid' 
      }))
    }, 1000)
  }

  const saveConfiguration = () => {
    // Aqui seria chamada a API do Electron para salvar configurações
    toast("Configurações salvas", {
      description: "As alterações foram aplicadas com sucesso."
    })
  }

  const testConnection = () => {
    toast("Testando conexão...", {
      description: "Verificando acesso aos caminhos UNC..."
    })
    
    // Simular teste de conexão
    setTimeout(() => {
      toast("Conexão bem-sucedida", {
        description: "Todos os caminhos estão acessíveis."
      })
    }, 2000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin text-[#F39C12]" />
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-[#27AE60]" />
      case 'invalid':
        return <XCircle className="h-4 w-4 text-[#E74C3C]" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-8 w-8 bg-[#F1C40F] rounded flex items-center justify-center text-black font-bold">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-2xl font-medium">Configurações</h1>
            <p className="text-[#A7A7A7]">Configure os caminhos UNC e parâmetros do sistema</p>
          </div>
        </div>

        {/* Paths Configuration */}
        <Card className="bg-[#1B1B1B] border-[#2C2C2C]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[#F1C40F]" />
              Caminhos UNC
            </CardTitle>
            <CardDescription className="text-[#A7A7A7]">
              Configure os caminhos de rede para processamento dos arquivos XML
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(paths).map(([key, path]) => (
              <div key={key} className="space-y-2">
                <Label className="text-white capitalize">{key.replace('_', ' ')}</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={path}
                      onChange={(e) => handlePathChange(key, e.target.value)}
                      placeholder={`\\\\server\\${key.toUpperCase()}`}
                      className="bg-[#111111] border-[#2C2C2C] text-white font-mono"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validatePath(key, path)}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] min-w-[100px]"
                  >
                    {getStatusIcon(pathStatus[key])}
                    <span className="ml-2">Validar</span>
                  </Button>
                </div>
                {pathStatus[key] === 'invalid' && (
                  <p className="text-[#E74C3C] text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    Caminho inválido ou inacessível
                  </p>
                )}
                {pathStatus[key] === 'valid' && (
                  <p className="text-[#27AE60] text-sm flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    Caminho válido e acessível
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Processing Rules */}
        <Card className="bg-[#1B1B1B] border-[#2C2C2C]">
          <CardHeader>
            <CardTitle className="text-white">Regras de Processamento</CardTitle>
            <CardDescription className="text-[#A7A7A7]">
              Configurações de validação e auto-fix
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-white">Plugins Obrigatórios</h4>
                <div className="flex gap-2 flex-wrap">
                  {['2530', '2534', '2341', '2525'].map(plugin => (
                    <Badge key={plugin} variant="outline" className="text-[#F1C40F] border-[#F1C40F]/20 bg-[#F1C40F]/10">
                      {plugin}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-white">Auto-fix Habilitado</h4>
                <div className="space-y-2 text-sm text-[#A7A7A7]">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-[#27AE60]" />
                    <span>Quantidade zerada → 1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-[#27AE60]" />
                    <span>Preço zerado → 0.10</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="bg-[#1B1B1B] border-[#2C2C2C]">
          <CardHeader>
            <CardTitle className="text-white">Status do Sistema</CardTitle>
            <CardDescription className="text-[#A7A7A7]">
              Informações sobre a conexão e estado atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="h-12 w-12 bg-[#27AE60]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="h-6 w-6 text-[#27AE60]" />
                </div>
                <p className="text-sm text-white font-medium">Conectado</p>
                <p className="text-xs text-[#A7A7A7]">Sistema operacional</p>
              </div>
              
              <div className="text-center">
                <div className="h-12 w-12 bg-[#F39C12]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <RefreshCw className="h-6 w-6 text-[#F39C12]" />
                </div>
                <p className="text-sm text-white font-medium">Aguardando</p>
                <p className="text-xs text-[#A7A7A7]">Monitoramento parado</p>
              </div>
              
              <div className="text-center">
                <div className="h-12 w-12 bg-[#3498DB]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Info className="h-6 w-6 text-[#3498DB]" />
                </div>
                <p className="text-sm text-white font-medium">v1.0.0</p>
                <p className="text-xs text-[#A7A7A7]">Versão atual</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={testConnection}
            className="gap-2 border-[#2C2C2C] hover:bg-[#2C2C2C]"
          >
            <RefreshCw className="h-4 w-4" />
            Testar Conexão
          </Button>
          
          <Button
            onClick={saveConfiguration}
            className="gap-2 bg-[#F1C40F] hover:bg-[#E8B907] text-black"
          >
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  )
}