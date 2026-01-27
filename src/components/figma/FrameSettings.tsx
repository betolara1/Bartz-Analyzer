import { ConfigurationScreen } from "../ConfigurationScreen"

export function FrameSettings() {
  return (
    <div 
      className="w-[1000px] h-[700px] bg-[#111111] border border-[#2C2C2C] overflow-hidden"
      style={{ minWidth: '1000px', minHeight: '700px' }}
    >
      <ConfigurationScreen />
    </div>
  )
}