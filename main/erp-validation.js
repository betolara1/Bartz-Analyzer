// main/erp-validation.js
// Extrai códigos de itens de um XML e valida cada um contra o ERP (CSV de painéis,
// API de cores, API de itens). Mantém caches em memória durante a sessão do app.
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");

function extractItemCodes(txt) {
  const itemMatches = Array.from(txt.matchAll(/<ITEM\b[\s\S]*?>/gi));
  const codes = [];
  for (const m of itemMatches) {
    const itemTag = m[0];
    const refMatch = itemTag.match(/\bREFERENCIA\s*=\s*"([^"]*)"/i);
    const baseMatch = itemTag.match(/\bITEM_BASE\s*=\s*"([^"]*)"/i);
    const ref = refMatch ? refMatch[1].trim() : "";
    const base = baseMatch ? baseMatch[1].trim() : "";
    const codigo = ref || base;
    if (codigo) {
      codes.push(codigo);
    }
  }
  return Array.from(new Set(codes));
}

async function checkCodeExistsInErp(codigo, cache = {}) {
  let processedCode = codigo.trim();
  const originalUpper = processedCode.toUpperCase();

  // Ignorar códigos de cores coringas (ex: TAPAFURO_CG1, CHAPA_CG2, etc)
  const wildcardPatterns = [
    'CHAPA_CG',
    'PAINEL_CG',
    'FITA_CG',
    'TAPAFURO_CG',
    'CAPA_CG'
  ];
  if (wildcardPatterns.some(p => originalUpper.includes(p))) {
    return true; // Ignora a consulta no ERP, assume como válido para este check
  }

  // 1. Remover sufixo CG1 ou CG2 do final do código (case-insensitive)
  if (/cg[12]$/i.test(processedCode)) {
    processedCode = processedCode.slice(0, -3);
  }

  // 2. Se o código terminar com um número seguido de exatamente duas letras (sufixo de cor), remove as duas letras
  if (/\d[a-zA-Z]{2}$/.test(processedCode)) {
    processedCode = processedCode.slice(0, -2);
  }

  const upperCode = processedCode.toUpperCase();
  if (!upperCode) return true;

  if (cache.results && cache.results.has(upperCode)) {
    return cache.results.get(upperCode);
  }

  let exists = false;

  // 1. Verificar CSV de painéis
  if (!exists && cache.panels) {
    exists = cache.panels.has(upperCode);
  } else if (!exists) {
    try {
      const csvPath = '\\\\192.168.1.10\\Promob\\codigos_paineis.csv';
      if (await fse.pathExists(csvPath)) {
        const content = await fsp.readFile(csvPath, 'utf8');
        const lines = content.split(/\r?\n/).filter(x => x.trim());
        const header = lines[0] || '';
        const delimiter = header.includes(';') ? ';' : '\t';
        cache.panels = new Set();
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter);
          if (cols.length < 2) continue;
          const rowCode = (cols[0] || '').trim().toUpperCase();
          if (rowCode) cache.panels.add(rowCode);
        }
        exists = cache.panels.has(upperCode);
      }
    } catch (csvErr) {
      console.error('[ERP Validation] Erro ao ler CSV de painéis:', csvErr.message);
    }
  }

  // 2. Verificar API de cores
  if (!exists && cache.colors) {
    exists = cache.colors.has(upperCode);
  } else if (!exists) {
    try {
      const url = `http://192.168.1.10:8081/api/cor?size=2000`;
      const response = await fetch(url, {
        headers: { 'X-API-KEY': 'bartznewmoveisapi' },
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        if (response.status === 204) {
          exists = false;
        } else {
          const text = await response.text();
          if (!text || text.trim() === '') {
            exists = false;
          } else {
            const data = JSON.parse(text);
            let corResults = [];
            if (Array.isArray(data)) {
              corResults = data;
            } else if (data && Array.isArray(data.content)) {
              corResults = data.content;
            }
            cache.colors = new Set();
            corResults.forEach(item => {
              const fields = [
                item.siglaCor,
                item.sigla,
                item.code,
                item.itemCode,
                item.refComercial,
                item.id
              ];
              fields.forEach(f => {
                if (f) {
                  const clean = f.toString().trim().toUpperCase();
                  cache.colors.add(clean);
                }
              });
            });
            exists = cache.colors.has(upperCode);
          }
        }
      } else {
        exists = true; // Se falhou a resposta HTTP, assume que existe para evitar falso positivo
      }
    } catch (colorErr) {
      console.error('[ERP Validation] Erro ao buscar API de cores:', colorErr.message);
      exists = true; // Timeout ou erro de rede -> assume que existe
    }
  }

  // 3. Verificar API de itens do ERP
  if (!exists) {
    try {
      const url = `http://192.168.1.10:8081/api/item/search-code?q=${encodeURIComponent(upperCode)}`;
      const response = await fetch(url, {
        headers: { 'X-API-KEY': 'bartznewmoveisapi' },
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        if (response.status === 204) {
          exists = false;
        } else {
          const text = await response.text();
          if (!text || text.trim() === '') {
            exists = false;
          } else {
            const data = JSON.parse(text);
            const erpResults = Array.isArray(data) ? data : (data ? [data] : []);
            exists = erpResults.some(item => {
              const fieldsToTry = [
                item.code,
                item.CODIGO,
                item.item_code,
                item.codeItem,
                item.refComercial
              ];
              return fieldsToTry.some(f => {
                if (!f) return false;
                const cleanField = f.toString().trim().toUpperCase();
                return cleanField === upperCode;
              });
            });
          }
        }
      } else {
        exists = true; // Falha na resposta -> assume que existe
      }
    } catch (erpErr) {
      console.error(`[ERP Validation] Erro ao buscar código ${upperCode} no ERP:`, erpErr.message);
      exists = true; // Timeout ou erro de rede -> assume que existe
    }
  }

  if (!cache.results) cache.results = new Map();
  cache.results.set(upperCode, exists);
  return exists;
}

// Cache global persistente para validação de ERP durante a sessão
const globalErpCache = new Map();
let globalPanelsCache = null;
let globalColorsCache = null;

/**
 * Valida os itens do XML contra o ERP e adiciona erros/tags/meta ao payload
 * quando algum código não é encontrado. Usada por validateXml (main/xml-processor.js).
 */
async function runErpValidation(updatedTxt, payload) {
  try {
    const uniqueCodes = extractItemCodes(updatedTxt);
    if (uniqueCodes.length === 0) return;

    const cache = {
      results: globalErpCache,
      panels: globalPanelsCache,
      colors: globalColorsCache
    };
    const results = [];

    // Lote de concorrência controlada de 5 por vez
    const limit = 5;
    for (let i = 0; i < uniqueCodes.length; i += limit) {
      const chunk = uniqueCodes.slice(i, i + limit);
      const chunkPromises = chunk.map(async (code) => {
        const exists = await checkCodeExistsInErp(code, cache);
        return { code, exists };
      });
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    // Sincronizar de volta os caches de panels e colors para a variável global
    globalPanelsCache = cache.panels;
    globalColorsCache = cache.colors;

    let missingAny = false;
    const missingErpItems = [];

    // Extrair todos os itens do XML para associar detalhes caso não existam no ERP
    const xmlItems = [];
    const itemMatches = Array.from(updatedTxt.matchAll(/<ITEM\b[\s\S]*?>/gi));
    for (const m of itemMatches) {
      const itemTag = m[0];
      const idMatch = itemTag.match(/\bID\s*=\s*"([^"]*)"/i);
      const refMatch = itemTag.match(/\bREFERENCIA\s*=\s*"([^"]*)"/i);
      const baseMatch = itemTag.match(/\bITEM_BASE\s*=\s*"([^"]*)"/i);
      const descMatch = itemTag.match(/\bDESCRICAO\s*=\s*"([^"]*)"/i);
      const largMatch = itemTag.match(/\bLARGURA\s*=\s*"([^"]*)"/i);
      const altMatch = itemTag.match(/\bALTURA\s*=\s*"([^"]*)"/i);
      const profMatch = itemTag.match(/\bPROFUNDIDADE\s*=\s*"([^"]*)"/i);
      const caminhoMatch = itemTag.match(/\bCAMINHOITEMCATALOG\s*=\s*"([^"]*)"/i);

      const ref = refMatch ? refMatch[1].trim() : "";
      const base = baseMatch ? baseMatch[1].trim() : "";
      const code = ref || base;

      if (code) {
        const parseDim = (val) => {
          if (!val) return "0";
          const num = parseFloat(val);
          return isNaN(num) ? "0" : Math.round(num).toString();
        };

        xmlItems.push({
          id: idMatch ? idMatch[1] : "",
          code: code,
          referencia: ref,
          itemBase: base,
          descricao: descMatch ? descMatch[1] : "",
          largura: parseDim(largMatch ? largMatch[1] : ""),
          altura: parseDim(altMatch ? altMatch[1] : ""),
          profundidade: parseDim(profMatch ? profMatch[1] : ""),
          caminhoItemCatalog: caminhoMatch ? caminhoMatch[1] : ""
        });
      }
    }

    for (const res of results) {
      if (!res.exists) {
        payload.erros.push({
          descricao: `o item não encontrado no erp (${res.code})`,
          referencia: res.code
        });
        missingAny = true;

        // Buscar itens correspondentes no XML para detalhar
        const matchingItems = xmlItems.filter(item => item.code.toUpperCase() === res.code.toUpperCase());
        for (const item of matchingItems) {
          if (!missingErpItems.some(x => x.id === item.id)) {
            missingErpItems.push(item);
          }
        }
      }
    }
    if (missingAny) {
      payload.tags.push("sem código erp");
      payload.meta.missingErpItems = missingErpItems;
      // Dedup final das tags e erros
      payload.tags = Array.from(new Set(payload.tags));
      const s = new Set();
      payload.erros = (payload.erros || []).filter(x => {
        const k = (typeof x === "string" ? x : x?.descricao || String(x)).toLowerCase();
        if (s.has(k)) return false; s.add(k); return true;
      });
    }
  } catch (erpValErr) {
    console.error('[ERP Validation Flow] Erro crítico na validação ERP:', erpValErr.message);
  }
}

module.exports = { extractItemCodes, checkCodeExistsInErp, runErpValidation };
