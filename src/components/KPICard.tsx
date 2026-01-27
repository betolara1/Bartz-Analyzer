import { Card, CardContent } from "./ui/card"
export function KPICard({ title, value, icon, color, selected, onClick }:{
  title:string; value:number; icon:React.ReactNode; color:string; selected?:boolean; onClick?:()=>void;
}) {
  return (
    <Card onClick={onClick} className={`cursor-pointer ${selected ? "ring-2 ring-yellow-400" : ""}`}>
      <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
        <div className="text-2xl" style={{ color }}>{icon}</div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  )
}
  