import { useState } from "react"
import { ChipFilter, type FilterTag } from "../ui/chip-filter"
import { FilterBar } from "../ui/filter-bar"
import { Separator } from "../ui/separator"
import { Card } from "../ui/card"

export function FilterBarShowcase() {
  const [selectedTag, setSelectedTag] = useState<FilterTag>("all")

  return (
    <div className="min-h-screen bg-[#111111] text-white p-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-medium">Filter Bar Components</h1>
        <p className="text-[#A7A7A7] text-lg">Componentes de filtro para verificador de XML</p>
      </div>

      <Separator className="bg-[#2A2F3A]" />

      {/* Chip/Filter Individual States */}
      <section className="space-y-6">
        <h2 className="text-2xl font-medium">Chip/Filter - Estados</h2>
        
        <div className="space-y-6">
          {/* Default State */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-[#EAECEF]">Estado Padrão</h3>
            <div className="flex flex-wrap gap-2 p-4 bg-[#1C1F26] rounded-lg border border-[#2A2F3A]">
              <ChipFilter label="Todos" tag="all" />
              <ChipFilter label="Corretos" tag="ok" />
              <ChipFilter label="Inconformidades" tag="erro" />
              <ChipFilter label="Muxarabi" tag="muxarabi" />
            </div>
          </div>

          {/* Selected State */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-[#EAECEF]">Estado Selecionado</h3>
            <div className="flex flex-wrap gap-2 p-4 bg-[#1C1F26] rounded-lg border border-[#2A2F3A]">
              <ChipFilter label="Todos" tag="all" selected />
              <ChipFilter label="Corretos" tag="ok" selected />
              <ChipFilter label="Inconformidades" tag="erro" selected />
              <ChipFilter label="Muxarabi" tag="muxarabi" selected />
            </div>
          </div>

          {/* Disabled State */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-[#EAECEF]">Estado Desabilitado</h3>
            <div className="flex flex-wrap gap-2 p-4 bg-[#1C1F26] rounded-lg border border-[#2A2F3A]">
              <ChipFilter label="Todos" tag="all" disabled />
              <ChipFilter label="Corretos" tag="ok" disabled />
              <ChipFilter label="Inconformidades" tag="erro" disabled />
              <ChipFilter label="Muxarabi" tag="muxarabi" disabled />
            </div>
          </div>

          {/* All Icons */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-[#EAECEF]">Todos os Ícones</h3>
            <div className="flex flex-wrap gap-2 p-4 bg-[#1C1F26] rounded-lg border border-[#2A2F3A]">
              <ChipFilter label="Todos" tag="all" />
              <ChipFilter label="Corretos" tag="ok" />
              <ChipFilter label="Erro" tag="erro" />
              <ChipFilter label="Muxarabi" tag="muxarabi" />
              <ChipFilter label="Cor Coringa" tag="coringa" />
              <ChipFilter label="Ferragens" tag="ferragens" />
              <ChipFilter label="Preço 0.00" tag="precoZero" />
              <ChipFilter label="Qtd 0" tag="qtdZero" />
            </div>
          </div>
        </div>
      </section>

      <Separator className="bg-[#2A2F3A]" />

      {/* FilterBar Component */}
      <section className="space-y-6">
        <h2 className="text-2xl font-medium">FilterBar - Componente Completo</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-[#EAECEF]">Funcional (Interativo)</h3>
            <p className="text-sm text-[#A7A7A7]">
              Tag selecionada: <span className="text-[#F1C40F] font-medium">{selectedTag}</span>
            </p>
          </div>
          
          <Card className="p-4 bg-[#1C1F26] border-[#2A2F3A]">
            <FilterBar 
              selectedTag={selectedTag}
              onTagChange={setSelectedTag}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-[#EAECEF]">Static (Para Figma)</h3>
          <Card className="p-4 bg-[#1C1F26] border-[#2A2F3A]">
            <FilterBar selectedTag="all" />
          </Card>
        </div>
      </section>

      <Separator className="bg-[#2A2F3A]" />

      {/* Design Specifications */}
      <section className="space-y-6">
        <h2 className="text-2xl font-medium">Especificações de Design</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Color Tokens */}
          <Card className="p-6 bg-[#1C1F26] border-[#2A2F3A]">
            <h3 className="text-lg font-medium text-[#EAECEF] mb-4">Color Tokens</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#A7A7A7]">bg/page:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#111111] border border-[#2A2F3A]"></div>
                  <span className="text-[#EAECEF] font-mono">#111111</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A7A7A7]">chip.bg:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#1C1F26] border border-[#2A2F3A]"></div>
                  <span className="text-[#EAECEF] font-mono">#1C1F26</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A7A7A7]">chip.border:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#2A2F3A] border border-[#2A2F3A]"></div>
                  <span className="text-[#EAECEF] font-mono">#2A2F3A</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A7A7A7]">accent:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#F1C40F] border border-[#2A2F3A]"></div>
                  <span className="text-[#EAECEF] font-mono">#F1C40F</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A7A7A7]">success:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#27AE60] border border-[#2A2F3A]"></div>
                  <span className="text-[#EAECEF] font-mono">#27AE60</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A7A7A7]">danger:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#E74C3C] border border-[#2A2F3A]"></div>
                  <span className="text-[#EAECEF] font-mono">#E74C3C</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Layout Specs */}
          <Card className="p-6 bg-[#1C1F26] border-[#2A2F3A]">
            <h3 className="text-lg font-medium text-[#EAECEF] mb-4">Layout Specs</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Padding:</span>
                <span className="text-[#EAECEF]">6px 10px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Border Radius:</span>
                <span className="text-[#EAECEF]">8px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Gap (icon-text):</span>
                <span className="text-[#EAECEF]">6px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Gap (between chips):</span>
                <span className="text-[#EAECEF]">8px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Font Size:</span>
                <span className="text-[#EAECEF]">14px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Font Weight:</span>
                <span className="text-[#EAECEF]">Medium (500)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">Min Height:</span>
                <span className="text-[#EAECEF]">36px</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <Separator className="bg-[#2A2F3A]" />

      {/* Implementation Notes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-medium">Notas de Implementação</h2>
        
        <Card className="p-6 bg-[#1C1F26] border-[#2A2F3A]">
          <div className="space-y-4 text-sm text-[#EAECEF]">
            <div>
              <h4 className="font-medium mb-2 text-[#F1C40F]">Acessibilidade:</h4>
              <ul className="space-y-1 text-[#A7A7A7] ml-4">
                <li>• Contraste mínimo 4.5:1 em todos os estados</li>
                <li>• Área de clique ≥ 36px de altura</li>
                <li>• Focus ring visível com Ctrl+Tab</li>
                <li>• Screen reader friendly com aria-labels</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2 text-[#F1C40F]">Auto Layout (Figma):</h4>
              <ul className="space-y-1 text-[#A7A7A7] ml-4">
                <li>• FilterBar: Horizontal, Wrap ON, Gap 8px</li>
                <li>• ChipFilter: Horizontal, Gap 6px, Padding 6px 10px</li>
                <li>• Corner radius: 8px em todos os chips</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2 text-[#F1C40F]">Variants (Figma):</h4>
              <ul className="space-y-1 text-[#A7A7A7] ml-4">
                <li>• selected: Boolean (true/false)</li>
                <li>• hover: Boolean (true/false)</li>
                <li>• disabled: Boolean (true/false)</li>
                <li>• tag: Enum (all, ok, erro, muxarabi, etc.)</li>
              </ul>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}