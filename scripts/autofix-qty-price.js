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
const LOG_FILE         = path.join(__dirname, "autofix-log.txt");            // Log geral do serviço
const CHANGES_LOG_FILE = path.join(__dirname, "autofix-itens-alterados.txt"); // Relatório detalhado dos itens alterados
const CHANGES_CSV_FILE = path.join(__dirname, "autofix-itens-alterados.csv"); // Planilha CSV para filtros no Excel

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
  // Gravar no log geral em arquivo também
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch (err) {
    // Silenciar erro no console para não interromper serviço
  }
}

// ═══════════════════════════════════════════════════════════════
//  REGISTRO DETALHADO DOS ITENS ALTERADOS (TXT e CSV)
// ═══════════════════════════════════════════════════════════════
function recordChanges(filePath, modifiedItems, stats) {
  if (!modifiedItems || modifiedItems.length === 0) return;

  const timestamp = ts();
  const baseName = path.basename(filePath);

  // 1. Gravar no relatório formatado em TXT
  let logText = "";
  if (!fs.existsSync(CHANGES_LOG_FILE)) {
    logText += "═══════════════════════════════════════════════════════════════════════════════\n";
    logText += " BARTZ ANALYZER — REGISTRO HISTÓRICO DE ITENS CORRIGIDOS (AUTO-FIX)\n";
    logText += " Monitoramento contínuo: QUANTIDADE (0 -> 1) e PREÇO (0 -> 0.10)\n";
    logText += "═══════════════════════════════════════════════════════════════════════════════\n\n";
  }

  logText += `[${timestamp}] ARQUIVO: ${baseName}\n`;
  logText += `Caminho: ${filePath}\n`;
  logText += `Resumo:  QTD corrigida em ${stats.qtyFixCount} item(ns) | PREÇO corrigido em ${stats.priceFixCount} item(ns)\n`;
  logText += `Itens alterados (${modifiedItems.length}):\n`;

  modifiedItems.forEach((item, idx) => {
    logText += `  (${idx + 1}) ID: ${item.id || "S/ID"} | Ref: "${item.referencia || "S/REF"}" | Base: "${item.itemBase || "-"}"\n`;
    if (item.descricao) {
      logText += `      Descrição: "${item.descricao}"\n`;
    }
    if (item.desenho || item.dimensao) {
      logText += `      Desenho: "${item.desenho || "-"}" | Dimensões: ${item.dimensao || "-"}\n`;
    }
    if (item.caminhoItemCatalog) {
      logText += `      Catálogo:  "${item.caminhoItemCatalog}"\n`;
    }
    logText += `      Alterações:\n`;
    item.alteracoes.forEach(alt => {
      logText += `        • ${alt.campo}: "${alt.antes}" → "${alt.depois}"\n`;
    });
  });
  logText += "───────────────────────────────────────────────────────────────────────────────\n\n";

  try {
    fs.appendFileSync(CHANGES_LOG_FILE, logText, "utf8");
  } catch (err) {
    log(`⚠️ Não foi possível gravar em ${path.basename(CHANGES_LOG_FILE)}: ${err.message}`, COLORS.yellow);
  }

  // 2. Gravar no CSV para fácil abertura e filtros no Excel
  try {
    let csvContent = "";
    if (!fs.existsSync(CHANGES_CSV_FILE)) {
      // Adicionar BOM UTF-8 (\uFEFF) para abrir com acentuação correta no Excel brasileiro
      csvContent += "\uFEFF";
      csvContent += [
        "Data/Hora",
        "Arquivo XML",
        "Caminho Completo",
        "ID Item",
        "Referencia",
        "Item Base",
        "Descricao",
        "Desenho",
        "Dimensoes",
        "Catalogo",
        "Campo Corrigido",
        "Valor Anterior",
        "Novo Valor"
      ].map(h => `"${h}"`).join(";") + "\r\n";
    }

    for (const item of modifiedItems) {
      for (const alt of item.alteracoes) {
        const row = [
          timestamp,
          baseName,
          filePath,
          item.id || "",
          item.referencia || "",
          item.itemBase || "",
          (item.descricao || "").replace(/"/g, '""'),
          item.desenho || "",
          item.dimensao || "",
          (item.caminhoItemCatalog || "").replace(/"/g, '""'),
          alt.campo,
          alt.antes,
          alt.depois
        ];
        csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";") + "\r\n";
      }
    }

    fs.appendFileSync(CHANGES_CSV_FILE, csvContent, "utf8");
  } catch (err) {
    log(`⚠️ Não foi possível gravar no CSV (se estiver aberto no Excel, feche-o para gravar): ${err.message}`, COLORS.yellow);
  }
}

// ═══════════════════════════════════════════════════════════════
//  NÚCLEO DO AUTO-FIX  (extraído de xml-logic.js)
// ═══════════════════════════════════════════════════════════════
function applyAutoFix(txt) {
  let changed       = false;
  let priceFixCount = 0;
  let qtyFixCount   = 0;
  const modifiedItems = [];

  const updatedTxt = txt.replace(/<ITEM\b([^>]*)>/gi, (_full, attrs) => {
    let updatedAttrs = attrs;
    const itemChanges = [];

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
        itemChanges.push({
          campo: "QUANTIDADE",
          antes: qtyVal,
          depois: "1"
        });
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
        itemChanges.push({
          campo: "PRECO_TOTAL",
          antes: pVal,
          depois: "0.10"
        });
      }
    }

    if (itemChanges.length > 0) {
      const idMatch   = attrs.match(/\bID\s*=\s*"([^"]*)"/i);
      const descMatch = attrs.match(/\bDESCRICAO\s*=\s*"([^"]*)"/i);
      const baseMatch = attrs.match(/\bITEM_BASE\s*=\s*"([^"]*)"/i);
      const desMatch  = attrs.match(/\bDESENHO\s*=\s*"([^"]*)"/i);
      const largMatch = attrs.match(/\bLARGURA\s*=\s*"([^"]*)"/i);
      const altMatch  = attrs.match(/\bALTURA\s*=\s*"([^"]*)"/i);
      const profMatch = attrs.match(/\bPROFUNDIDADE\s*=\s*"([^"]*)"/i);
      const catMatch  = attrs.match(/\bCAMINHOITEMCATALOG\s*=\s*"([^"]*)"/i);

      let dimensao = "";
      if (largMatch || altMatch || profMatch) {
        const l = largMatch ? Math.round(parseFloat(largMatch[1])) || 0 : 0;
        const a = altMatch  ? Math.round(parseFloat(altMatch[1]))  || 0 : 0;
        const p = profMatch ? Math.round(parseFloat(profMatch[1])) || 0 : 0;
        dimensao = `${l}x${a}x${p}`;
      }

      modifiedItems.push({
        id: idMatch ? idMatch[1].trim() : "",
        referencia: ref,
        itemBase: baseMatch ? baseMatch[1].trim() : "",
        descricao: descMatch ? descMatch[1].trim() : "",
        desenho: desMatch ? desMatch[1].trim() : "",
        dimensao,
        caminhoItemCatalog: catMatch ? catMatch[1].trim() : "",
        alteracoes: itemChanges
      });
    }

    return `<ITEM${updatedAttrs}>`;
  });

  return { updatedTxt, changed, qtyFixCount, priceFixCount, modifiedItems };
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

    const { updatedTxt, changed, qtyFixCount, priceFixCount, modifiedItems } = applyAutoFix(raw);

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

      // Registrar detalhadamente em TXT e CSV
      recordChanges(filePath, modifiedItems, { qtyFixCount, priceFixCount });

      // Exibir itens alterados no terminal para feedback imediato
      for (const item of modifiedItems) {
        const chgSummary = item.alteracoes.map(a => `${a.campo}: "${a.antes}" → "${a.depois}"`).join(", ");
        const info = [
          item.id ? `ID: ${item.id}` : null,
          item.referencia ? `Ref: ${item.referencia}` : null,
          item.descricao ? `Desc: ${item.descricao}` : null,
        ].filter(Boolean).join(" | ");
        log(`   ↳ [Item] ${info} → ${chgSummary}`, COLORS.cyan);
      }
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
  log(`  Pasta monitorada:       ${XML_FOLDER}`, COLORS.gray);
  log(`  Intervalo:              ${INTERVAL_MS / 1000}s`, COLORS.gray);
  log(`  Log de serviço:         ${LOG_FILE}`, COLORS.gray);
  log(`  Log de itens alterados: ${CHANGES_LOG_FILE}`, COLORS.gray);
  log(`  Planilha CSV (Excel):   ${CHANGES_CSV_FILE}`, COLORS.gray);
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
