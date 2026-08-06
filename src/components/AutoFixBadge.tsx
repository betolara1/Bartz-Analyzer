import { Badge } from "./ui/badge"

export function formatAutoFixText(fix: string): string {
  if (!fix) return "";
  let text = fix.trim();

  // Tratamento de mensagens legadas
  if (/^(DXF:\s*)?já estava correto no arquivo\s+/i.test(text)) {
    text = text.replace(/^(DXF:\s*)?já estava correto no arquivo\s+/i, "Item duplado (37mm) já estava correto no arquivo ");
  } else if (/^(DXF:\s*)?corrigido duplado \(37mm\/31mm\) no arquivo\s+/i.test(text)) {
    text = text.replace(/^(DXF:\s*)?corrigido duplado \(37mm\/31mm\) no arquivo\s+/i, "Corrigido item duplado (37mm) no arquivo ");
  } else if (/^(DXF:\s*)?cópia atualizada na pasta espelho\s+/i.test(text)) {
    text = text.replace(/^(DXF:\s*)?cópia atualizada na pasta espelho\s+/i, "Cópia de item duplado atualizada na pasta espelho ");
  } else {
    // Remove qualquer prefixo "DXF: " se presente
    text = text.replace(/^DXF:\s*/i, "");
  }

  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

export function AutoFixBadge({ fix }: { fix: string }) {
  const displayText = formatAutoFixText(fix);
  return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">{displayText}</Badge>
}
