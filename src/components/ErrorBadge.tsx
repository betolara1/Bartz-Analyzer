import { Badge } from "./ui/badge"
export function ErrorBadge({ error }: { error: string }) {
  return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-xs">{error}</Badge>
}
