import { ComponentLibrary } from "./components/figma/ComponentLibrary"
import { FrameDashboard } from "./components/figma/FrameDashboard"
import { FrameDetailDrawer } from "./components/figma/FrameDetailDrawer"
import { FrameSettings } from "./components/figma/FrameSettings"
import { EnhancedDashboard } from "./components/figma/EnhancedDashboard"
import { Separator } from "./components/ui/separator"

export function FigmaShowcase() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-8 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-medium text-white">Bartz Analyzer - Figma Showcase</h1>
        <p className="text-[#A7A7A7] text-lg">Sistema de monitoramento e processamento de XMLs de orçamento de móveis</p>
      </div>

      <Separator className="bg-[#2C2C2C]" />

      {/* Frames Principais */}
      <section className="space-y-8">
        <h2 className="text-2xl font-medium text-white">Frames Principais</h2>
        
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl text-white">Frame/Dashboard</h3>
            <FrameDashboard />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl text-white">Frame/Dashboard (Estado Vazio)</h3>
            <div className="w-[1200px] h-[800px] bg-[#111111] border border-[#2C2C2C] overflow-hidden">
              <EnhancedDashboard onNavigateToConfig={() => {}} showState="empty" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl text-white">Frame/Dashboard (Estado Carregando)</h3>
            <div className="w-[1200px] h-[800px] bg-[#111111] border border-[#2C2C2C] overflow-hidden">
              <EnhancedDashboard onNavigateToConfig={() => {}} showState="loading" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl text-white">Frame/DetailDrawer</h3>
            <FrameDetailDrawer />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl text-white">Frame/Settings</h3>
            <FrameSettings />
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Biblioteca de Componentes */}
      <section className="space-y-8">
        <h2 className="text-2xl font-medium text-white">Biblioteca de Componentes</h2>
        <ComponentLibrary />
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Especificações Técnicas */}
      <section className="space-y-6">
        <h2 className="text-2xl font-medium text-white">Especificações Técnicas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Design Tokens</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">bg/base:</span>
                <span className="text-white">#111111</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">bg/surface:</span>
                <span className="text-white">#1B1B1B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">border:</span>
                <span className="text-white">#2C2C2C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">accent/bartz:</span>
                <span className="text-white">#F1C40F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">status/success:</span>
                <span className="text-white">#27AE60</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">status/error:</span>
                <span className="text-white">#E74C3C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7A7A7]">status/warning:</span>
                <span className="text-white">#F39C12</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Tipografia</h3>
            <div className="space-y-3">
              <div className="text-2xl font-medium">Display/H1</div>
              <div className="text-xl font-medium">H2</div>
              <div className="text-lg font-medium">H3</div>
              <div className="text-base">Body</div>
              <div className="text-sm text-[#A7A7A7]">Caption</div>
              <div className="text-xs bg-[#E74C3C]/10 text-[#E74C3C] px-2 py-1 rounded inline-block">Badge</div>
            </div>
          </div>
        </div>
      </section>

      <Separator className="bg-[#2C2C2C]" />

      {/* Instruções para Figma */}
      <section className="space-y-6">
        <h2 className="text-2xl font-medium text-white">Instruções para Implementação no Figma</h2>
        
        <div className="bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg p-6">
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="text-white font-medium mb-2">1. Organização de Páginas:</h4>
              <ul className="text-[#A7A7A7] space-y-1 ml-4">
                <li>• Página "Bartz Analyzer" - Frames principais</li>
                <li>• Página "Componentes" - Biblioteca de componentes</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-medium mb-2">2. Nomenclatura de Camadas:</h4>
              <ul className="text-[#A7A7A7] space-y-1 ml-4">
                <li>• Frame/Dashboard, Frame/DetailDrawer, Frame/Settings</li>
                <li>• Chip/Status/OK, Chip/Status/ERRO, Chip/Status/FERRAGENS</li>
                <li>• Badge/Erro/ItemSemPreco, Badge/Erro/Maquina2534Ausente</li>
                <li>• Card/KPI/Recebidos, Card/KPI/Corretos</li>
                <li>• Table/Row/Default, Table/Row/Error, Table/Header</li>
                <li>• Toast/Success, Toast/Warning, Toast/Error</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-medium mb-2">3. Auto Layout e Spacings:</h4>
              <ul className="text-[#A7A7A7] space-y-1 ml-4">
                <li>• Usar Auto Layout em todos os containers</li>
                <li>• Spacings: 8px (tight), 12px (normal), 16px (loose)</li>
                <li>• Mínimo 1000×700 para responsividade</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-medium mb-2">4. Estados a Implementar:</h4>
              <ul className="text-[#A7A7A7] space-y-1 ml-4">
                <li>• Dashboard normal, vazio, carregando</li>
                <li>• Rows com 1 erro, 3+ erros, ferragens-only, ok com auto-fix</li>
                <li>• Todas as variantes de badges e chips</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default FigmaShowcase