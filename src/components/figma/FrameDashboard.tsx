import { Dashboard } from "../Dashboard"

export function FrameDashboard() {
  const handleNavigateToConfig = () => {
    // Mock function for Figma frame
  }

  return (
    <div 
      className="w-[1200px] h-[800px] bg-[#111111] border border-[#2C2C2C] overflow-hidden"
      style={{ minWidth: '1000px', minHeight: '700px' }}
    >
      <Dashboard onNavigateToConfig={handleNavigateToConfig} />
    </div>
  )
}