import { useState, useCallback } from 'react'
import { toast } from "sonner"

interface ProcessResult {
  arquivo: string
  status: 'ok' | 'erro' | 'FERRAGENS-ONLY'
  erros: string[]
  avisos: string[]
  autoFix: string[]
  tags: string[]
}

interface FileProcessingState {
  isProcessing: boolean
  processedFiles: ProcessResult[]
  totalProcessed: number
  successCount: number
  errorCount: number
  ferragensCount: number
}

export function useBartzProcessor() {
  const [state, setState] = useState<FileProcessingState>({
    isProcessing: false,
    processedFiles: [],
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    ferragensCount: 0
  })

  // Simula a análise de XML baseada na lógica real do backend
  const simulateXMLAnalysis = useCallback((filename: string): ProcessResult => {
    const errors: string[] = []
    const warnings: string[] = []
    const autoFix: string[] = []
    const tags: string[] = []

    // Simula diferentes cenários baseados no nome do arquivo
    if (filename.includes('MUXARABI') || filename.includes('MX600')) {
      errors.push('PEÇA MUXARABI')
      tags.push('muxarabi')
    }

    if (filename.includes('CORINGA') || filename.includes('CG1') || filename.includes('CG2')) {
      errors.push('CADASTRO DE COR CORINGA')
      tags.push('coringa')
    }

    if (filename.includes('FERRAGENS') || filename.includes('BUILDER_N')) {
      warnings.push('PEDIDO APENAS DE FERRAGENS — plugins ignorados (BUILDER=N ou padrão de códigos).')
      tags.push('ferragens')
      return {
        arquivo: filename,
        status: 'FERRAGENS-ONLY',
        erros: [],
        avisos: warnings,
        autoFix,
        tags
      }
    }

    // Simula problemas de validação
    const hasQuantityIssue = Math.random() > 0.7
    const hasPriceIssue = Math.random() > 0.8
    const hasMissingPlugin = Math.random() > 0.6
    const hasMissingCode = Math.random() > 0.75

    if (hasQuantityIssue) {
      autoFix.push('QUANTIDADE=0→1')
      tags.push('qtdZero')
    }

    if (hasPriceIssue) {
      autoFix.push('PRECO_TOTAL=0.00→0.10')
      tags.push('precoZero')
    }

    if (hasMissingCode) {
      errors.push('ITEM SEM CÓDIGO')
    }

    if (hasMissingPlugin && !tags.includes('ferragens')) {
      const plugins = ['2530', '2534', '2341', '2525']
      const randomPlugin = plugins[Math.floor(Math.random() * plugins.length)]
      
      if (Math.random() > 0.5) {
        errors.push(`MAQUINA COM PLUGIN ${randomPlugin} AUSENTE`)
      } else {
        errors.push(`PROGRAMA NÃO GERADO PARA PLUGIN ${randomPlugin}`)
      }
    }

    const finalStatus = errors.length > 0 ? 'erro' : 'ok'

    return {
      arquivo: filename,
      status: finalStatus,
      erros: errors,
      avisos: warnings,
      autoFix,
      tags
    }
  }, [])

  const processFile = useCallback((filename: string) => {
    setState(prev => ({ ...prev, isProcessing: true }))

    toast("Iniciando processamento", {
      description: `Analisando ${filename}...`
    })

    // Simula tempo de processamento
    setTimeout(() => {
      const result = simulateXMLAnalysis(filename)
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        processedFiles: [...prev.processedFiles, result],
        totalProcessed: prev.totalProcessed + 1,
        successCount: result.status === 'ok' ? prev.successCount + 1 : prev.successCount,
        errorCount: result.status === 'erro' ? prev.errorCount + 1 : prev.errorCount,
        ferragensCount: result.status === 'FERRAGENS-ONLY' ? prev.ferragensCount + 1 : prev.ferragensCount
      }))

      // Toast baseado no resultado
      if (result.status === 'ok') {
        if (result.autoFix.length > 0) {
          toast("Arquivo corrigido automaticamente", {
            description: `${filename} - ${result.autoFix.join(', ')}`
          })
        } else {
          toast("Arquivo processado com sucesso", {
            description: `${filename} movido para pasta final.`
          })
        }
      } else if (result.status === 'FERRAGENS-ONLY') {
        toast("Pedido apenas de ferragens", {
          description: `${filename} - plugins ignorados.`
        })
      } else {
        toast("Arquivo com inconformidades", {
          description: `${filename} - ${result.erros.length} erro(s) encontrado(s).`
        })
      }
    }, 1500 + Math.random() * 1000) // 1.5-2.5 segundos
  }, [simulateXMLAnalysis])

  const batchProcess = useCallback((filenames: string[]) => {
    setState(prev => ({ ...prev, isProcessing: true }))
    
    toast("Processamento em lote iniciado", {
      description: `Processando ${filenames.length} arquivos...`
    })

    let processed = 0
    filenames.forEach((filename, index) => {
      setTimeout(() => {
        const result = simulateXMLAnalysis(filename)
        
        setState(prev => ({
          ...prev,
          processedFiles: [...prev.processedFiles, result],
          totalProcessed: prev.totalProcessed + 1,
          successCount: result.status === 'ok' ? prev.successCount + 1 : prev.successCount,
          errorCount: result.status === 'erro' ? prev.errorCount + 1 : prev.errorCount,
          ferragensCount: result.status === 'FERRAGENS-ONLY' ? prev.ferragensCount + 1 : prev.ferragensCount
        }))

        processed++
        if (processed === filenames.length) {
          setState(prev => ({ ...prev, isProcessing: false }))
          toast("Processamento em lote concluído", {
            description: `${filenames.length} arquivos processados.`
          })
        }
      }, (index + 1) * (800 + Math.random() * 400))
    })
  }, [simulateXMLAnalysis])

  const clearHistory = useCallback(() => {
    setState({
      isProcessing: false,
      processedFiles: [],
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      ferragensCount: 0
    })
    toast("Histórico limpo")
  }, [])

  return {
    ...state,
    processFile,
    batchProcess,
    clearHistory,
    // Utilitários para análise
    getFilesByTag: useCallback((tag: string) => 
      state.processedFiles.filter(f => f.tags.includes(tag)), [state.processedFiles]),
    getFilesByStatus: useCallback((status: string) => 
      state.processedFiles.filter(f => f.status === status), [state.processedFiles]),
  }
}