import { Badge } from "./ui/badge"
export function AutoFixBadge({ fix }: { fix: string }) {
  return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">{fix}</Badge>
}
