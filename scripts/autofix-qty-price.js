// scripts/autofix-qty-price.js
// ─────────────────────────────────────────────────────────────────────
// Script autônomo de auto-fix: Quantidade e Preço
// Roda 24h, verificando a cada 5 segundos todos os XMLs na pasta de rede.
//
// Regras aplicadas (idênticas ao Bartz-Analyzer):
//   • QUANTIDADE = "0" (ou "0.0", "0.00"…) → troca para "1"
//     (somente se o item possuir REFERENCIA preenchida)
//   • PRECO_TOTAL = "0" (ou "0.0", "0.00"…) → troca para "0.10"
//
// Uso:  node scripts/autofix-qty-price.js
// ─────────────────────────────────────────────────────────────────────

const fs   = require("fs");
const fsp  = fs.promises;
const path = require("path");

// ═══════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════
const XML_FOLDER       = "\\\\192.168.1.10\\DatabaseFolder\\01_XML";
const INTERVAL_MS      = 5_000;          // 5 segundos
const LOG_FILE         = path.join(__dirname, "autofix-log.txt");

// ═══════════════════════════════════════════════════════════════
//  ESTADO INTERNO — evita reprocessar o mesmo conteúdo
//  Chave: filePath  →  Valor: hash md5 do conteúdo após fix
// ═══════════════════════════════════════════════════════════════
const crypto       = require("crypto");
const processedMap = new Map(); // filePath → { hash, mtime }

function md5(text) {
  return crypto.createHash("md5").update(text).digest("hex");
}

// ═══════════════════════════════════════════════════════════════
//  LOGGING com timestamp e cores
// ═══════════════════════════════════════════════════════════════
const COLORS = {
  reset:   "\x1b[0m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  cyan:    "\x1b[36m",
  red:     "\x1b[31m",
  gray:    "\x1b[90m",
  bold:    "\x1b[1m",
};

function ts() {
  return new Date().toLocaleString("pt-BR", { hour12: false });
}

function log(msg, color = COLORS.reset) {
  const line = `[${ts()}] ${msg}`;
  console.log(`${color}${line}${COLORS.reset}`);
  // Gravar no log em arquivo também
  fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
}

// ═══════════════════════════════════════════════════════════════
//  NÚCLEO DO AUTO-FIX  (extraído de xml-logic.js)
// ═══════════════════════════════════════════════════════════════
function applyAutoFix(txt) {
  let changed      = false;
  let priceFixCount = 0;
  let qtyFixCount   = 0;

  const updatedTxt = txt.replace(/<ITEM\b([^>]*)>/gi, (_full, attrs) => {
    let updatedAttrs = attrs;

    // ── Referência (só corrige quantidade se tiver referência) ──
    const refMatch = updatedAttrs.match(/\bREFERENCIA\s*=\s*"([^"]*)"/i);
    const ref = (refMatch?.[1] || "").trim();

    // ── QUANTIDADE: 0 → 1 ──
    const qtyMatch = updatedAttrs.match(/\bQUANTIDADE\s*=\s*"([^"]*)"/i);
    if (qtyMatch) {
      const qtyVal = (qtyMatch[1] || "").trim();
      if (ref && /^0(?:\.0+)?$/.test(qtyVal)) {
        updatedAttrs = updatedAttrs.replace(
          /(\bQUANTIDADE\s*=\s*")0(?:\.0+)?(")/i,
          `$11$2`
        );
        qtyFixCount++;
        changed = true;
      }
    }

    // ── PRECO_TOTAL: 0 → 0.10 ──
    const priceMatch = updatedAttrs.match(/\bPRECO_TOTAL\s*=\s*"([^"]*)"/i);
    if (priceMatch) {
      const pVal = (priceMatch[1] || "").trim();
      if (/^0(?:\.0+)?$/.test(pVal)) {
        updatedAttrs = updatedAttrs.replace(
          /(\bPRECO_TOTAL\s*=\s*")0(?:\.0+)?(")/i,
          `$10.10$2`
        );
        priceFixCount++;
        changed = true;
      }
    }

    return `<ITEM${updatedAttrs}>`;
  });

  return { updatedTxt, changed, qtyFixCount, priceFixCount };
}

// ═══════════════════════════════════════════════════════════════
//  PROCESSAMENTO DE UM ARQUIVO
// ═══════════════════════════════════════════════════════════════
async function processFile(filePath) {
  try {
    const stat = await fsp.stat(filePath);
    const mtime = stat.mtimeMs;

    // Verificar se já processamos este arquivo com este mtime
    const prev = processedMap.get(filePath);
    if (prev && prev.mtime === mtime) {
      return; // arquivo não mudou desde a última checagem
    }

    const raw = await fsp.readFile(filePath, "utf8");
    const hash = md5(raw);

    // Se o conteúdo é o mesmo que já processamos, pular
    if (prev && prev.hash === hash) {
      processedMap.set(filePath, { hash, mtime });
      return;
    }

    const { updatedTxt, changed, qtyFixCount, priceFixCount } = applyAutoFix(raw);

    if (changed) {
      await fsp.writeFile(filePath, updatedTxt, "utf8");
      const newHash = md5(updatedTxt);
      processedMap.set(filePath, { hash: newHash, mtime: Date.now() });

      const baseName = path.basename(filePath);
      const fixes = [];
      if (qtyFixCount > 0) fixes.push(`QTD: ${qtyFixCount} item(ns)`);
      if (priceFixCount > 0) fixes.push(`PREÇO: ${priceFixCount} item(ns)`);

      log(
        `✅ CORRIGIDO  ${baseName}  →  ${fixes.join(" | ")}`,
        COLORS.green
      );
    } else {
      // Arquivo lido mas sem correções necessárias
      processedMap.set(filePath, { hash, mtime });
    }
  } catch (err) {
    log(`❌ ERRO ao processar ${path.basename(filePath)}: ${err.message}`, COLORS.red);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CICLO PRINCIPAL
// ═══════════════════════════════════════════════════════════════
async function scanFolder() {
  try {
    const entries = await fsp.readdir(XML_FOLDER);
    const xmlFiles = entries
      .filter(f => /\.xml$/i.test(f))
      .map(f => path.join(XML_FOLDER, f));

    for (const fp of xmlFiles) {
      await processFile(fp);
    }
  } catch (err) {
    log(`⚠️  Erro ao acessar a pasta: ${err.message}`, COLORS.red);
  }
}

// ═══════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════
(async function main() {
  console.clear();
  log("═".repeat(60), COLORS.cyan);
  log("  BARTZ ANALYZER — Auto-Fix QTD & Preço (standalone)", COLORS.bold);
  log("═".repeat(60), COLORS.cyan);
  log(`  Pasta monitorada: ${XML_FOLDER}`, COLORS.gray);
  log(`  Intervalo:        ${INTERVAL_MS / 1000}s`, COLORS.gray);
  log(`  Log salvo em:     ${LOG_FILE}`, COLORS.gray);
  log("═".repeat(60), COLORS.cyan);
  log("");

  // Primeira execução imediata
  await scanFolder();
  log(`📂 Scan inicial concluído. Monitorando continuamente…`, COLORS.yellow);

  // Loop a cada 5 segundos
  setInterval(scanFolder, INTERVAL_MS);

  // Heartbeat a cada 5 minutos para saber que está vivo
  setInterval(() => {
    log(`💓 Heartbeat — ${processedMap.size} arquivo(s) rastreados`, COLORS.gray);
  }, 5 * 60 * 1000);
})();

// Graceful shutdown
process.on("SIGINT", () => {
  log("\n🛑 Encerrado pelo usuário (Ctrl+C)", COLORS.yellow);
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log(`💥 Erro não tratado: ${err.message}`, COLORS.red);
  // Continuar rodando mesmo com exceção não tratada
});
