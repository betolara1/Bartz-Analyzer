import { useState } from "react"
import { Dashboard } from "./components/Dashboard"
import { ConfigurationScreen } from "./components/ConfigurationScreen"
import { Toaster } from "./components/ui/sonner"

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'config'>('dashboard')

  return (
    <div className="dark">
      {currentScreen === 'dashboard' && (
        <Dashboard onNavigateToConfig={() => setCurrentScreen('config')} />
      )}
      
      {currentScreen === 'config' && (
        <div>
          <button 
            onClick={() => setCurrentScreen('dashboard')}
            className="fixed top-4 left-4 z-10 bg-[#1B1B1B] border border-[#2C2C2C] text-white px-3 py-2 rounded hover:bg-[#2C2C2C] transition-colors"
          >
            ← Voltar ao Dashboard
          </button>
          <ConfigurationScreen />
        </div>
      )}
      
      <Toaster 
        theme="dark"
        toastOptions={{
          style: {
            background: '#1B1B1B',
            border: '1px solid #2C2C2C',
            color: '#FFFFFF',
          },
        }}
      />
    </div>
  )
}