import { useState, useEffect, useCallback } from 'react'
import { toast } from "sonner"

// Definir tipos para APIs do Electron
declare global {
  interface Window {
    electronAPI?: {
      startWatching: () => void
      onFileProcessed: (callback: (event: any, result: ProcessResult) => void) => void
      reanalyzeAll: () => Promise<{ success: boolean; message: string }>
      reanalyzeErrors: () => Promise<{ success: boolean; message: string }>
    }
  }
}

interface ProcessResult {
  arquivo: string
  status: 'ok' | 'erro' | 'FERRAGENS-ONLY'
  erros: string[]
  avisos: string[]
  autoFix: string[]
  tags: string[]
  paths?: {
    origem: string
    working: string
    destino: string
    logs: string
  }
  timestamp?: string
  logPreview?: any
}

interface ElectronState {
  isMonitoring: boolean
  processedFiles: ProcessResult[]
  isConnected: boolean
}

export function useElectronAPI() {
  const [state, setState] = useState<ElectronState>({
    isMonitoring: false,
    processedFiles: [],
    isConnected: false
  })

  // Verificar se estamos no Electron
  useEffect(() => {
    const isElectron = window.electronAPI !== undefined
    setState(prev => ({ ...prev, isConnected: isElectron }))
    
    if (!isElectron) {
      console.warn('Electron APIs não disponíveis - rodando em modo web')
      return
    }

    // Configurar listener para arquivos processados
    const handleFileProcessed = (event: any, result: ProcessResult) => {
      // Adicionar timestamp se não existir
      const processedResult = {
        ...result,
        timestamp: result.timestamp || new Date().toLocaleString('pt-BR'),
        paths: result.paths || {
          origem: `\\\\server\\entrada\\${result.arquivo}`,
          working: `\\\\server\\working\\${result.arquivo}`,
          destino: `\\\\server\\XML_FINAL\\${result.status === 'ok' ? 'ok' : result.status === 'FERRAGENS-ONLY' ? 'ferragens' : 'erro'}\\${result.arquivo}`,
          logs: `\\\\server\\LOGS\\${result.status === 'erro' ? 'errors' : 'processed'}\\${result.arquivo.replace('.xml', '.json')}`
        },
        logPreview: result.logPreview || {
          status: result.status,
          processedAt: new Date().toISOString(),
          fase: "pós-fix",
          errors: result.erros,
          autoFixes: result.autoFix,
          warnings: result.avisos,
          tags: result.tags
        }
      }

      setState(prev => ({
        ...prev,
        processedFiles: [processedResult, ...prev.processedFiles].slice(0, 100) // Manter últimos 100
      }))

      // Toast baseado no resultado real
      if (result.status === 'ok') {
        if (result.autoFix.length > 0) {
          toast("Arquivo corrigido automaticamente", {
            description: `${result.arquivo} - ${result.autoFix.join(', ')}`
          })
        } else {
          toast("Arquivo processado com sucesso", {
            description: `${result.arquivo} movido para pasta final.`
          })
        }
      } else if (result.status === 'FERRAGENS-ONLY') {
        toast("Pedido apenas de ferragens", {
          description: `${result.arquivo} - plugins ignorados.`
        })
      } else {
        toast("Arquivo com inconformidades", {
          description: `${result.arquivo} - ${result.erros.length} erro(s) encontrado(s).`
        })
      }
    }

    window.electronAPI.onFileProcessed(handleFileProcessed)

    return () => {
      // Cleanup se necessário
    }
  }, [])

  const startMonitoring = useCallback(() => {
    if (!window.electronAPI) {
      toast("Erro", {
        description: "APIs do Electron não disponíveis"
      })
      return
    }

    try {
      window.electronAPI.startWatching()
      setState(prev => ({ ...prev, isMonitoring: true }))
      toast("Monitoramento iniciado", {
        description: "Aguardando novos XMLs na pasta de entrada..."
      })
    } catch (error) {
      toast("Erro ao iniciar monitoramento", {
        description: "Falha na comunicação com o sistema"
      })
    }
  }, [])

  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false }))
    toast("Monitoramento pausado", {
      description: "Processamento interrompido temporariamente."
    })
  }, [])

  const reanalyzeAll = useCallback(async () => {
    if (!window.electronAPI) {
      toast("Erro", { description: "APIs do Electron não disponíveis" })
      return
    }

    try {
      const result = await window.electronAPI.reanalyzeAll()
      if (result.success) {
        toast("Reanálise concluída", {
          description: result.message
        })
      } else {
        toast("Erro na reanálise", {
          description: result.message
        })
      }
    } catch (error) {
      toast("Erro na reanálise", {
        description: "Falha na comunicação com o backend"
      })
    }
  }, [])

  const reanalyzeErrors = useCallback(async () => {
    if (!window.electronAPI) {
      toast("Erro", { description: "APIs do Electron não disponíveis" })
      return
    }

    try {
      const result = await window.electronAPI.reanalyzeErrors()
      if (result.success) {
        toast("Reanálise de erros concluída", {
          description: result.message
        })
      } else {
        toast("Erro na reanálise", {
          description: result.message
        })
      }
    } catch (error) {
      toast("Erro na reanálise", {
        description: "Falha na comunicação com o backend"
      })
    }
  }, [])

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      processedFiles: []
    }))
    toast("Histórico limpo")
  }, [])

  // Utilitários para análise dos dados
  const getStats = useCallback(() => {
    const files = state.processedFiles
    return {
      total: files.length,
      ok: files.filter(f => f.status === 'ok').length,
      erro: files.filter(f => f.status === 'erro').length,
      ferragens: files.filter(f => f.status === 'FERRAGENS-ONLY').length,
      muxarabi: files.filter(f => f.tags.includes('muxarabi')).length,
      coringa: files.filter(f => f.tags.includes('coringa')).length,
      autoFixed: files.filter(f => f.autoFix.length > 0).length
    }
  }, [state.processedFiles])

  const getFilesByFilter = useCallback((filter: string) => {
    const files = state.processedFiles
    switch (filter) {
      case 'ok': return files.filter(f => f.status === 'ok')
      case 'erro': return files.filter(f => f.status === 'erro')
      case 'ferragens-only': return files.filter(f => f.status === 'FERRAGENS-ONLY')
      case 'muxarabi': return files.filter(f => f.tags.includes('muxarabi'))
      case 'cor-coringa': return files.filter(f => f.tags.includes('coringa'))
      case 'auto-fixed': return files.filter(f => f.autoFix.length > 0)
      default: return files
    }
  }, [state.processedFiles])

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    reanalyzeAll,
    reanalyzeErrors,
    clearHistory,
    getStats,
    getFilesByFilter
  }
}