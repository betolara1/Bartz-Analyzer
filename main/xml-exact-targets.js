// main/xml-exact-targets.js
// Localização EXATA de nós <ITEM> no XML (em qualquer profundidade) e edição apenas
// do conteúdo "próprio" de cada nó (sem tocar nos <ITEM> aninhados dentro dele).
// Usado somente pela aba "Itens" (exactIds: true). As outras abas seguem o fluxo antigo.

const ITEM_TAG_SOURCE = "<(\\/?)ITEM\\b([^>]*?)(\\/?)>";

function readAttr(tag, name) {
  const m = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : undefined;
}

function setAttr(tag, name, value) {
  const re = new RegExp(`\\b${name}\\s*=\\s*"[^"]*"`, "i");
  if (re.test(tag)) return tag.replace(re, () => `${name}="${value}"`);
  return tag.replace(/\s*(\/?)>$/, (_m, slash) => ` ${name}="${value}"${slash ? " /" : ""}>`);
}

function escapeXmlAttr(value) {
  return String(value)
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Todos os blocos <ITEM> do XML, em qualquer profundidade, com a árvore de filhos. */
function scanItemBlocks(xml) {
  const re = new RegExp(ITEM_TAG_SOURCE, "gi");
  const stack = [];
  const blocks = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const closing = m[1] === "/";
    const selfClosing = m[3] === "/";
    if (!closing) {
      const parent = stack[stack.length - 1] || null;
      const block = {
        start: m.index,
        openEnd: re.lastIndex,
        end: selfClosing ? re.lastIndex : -1,
        openTag: m[0],
        parent,
        children: [],
      };
      if (parent) parent.children.push(block);
      blocks.push(block);
      if (!selfClosing) stack.push(block);
    } else {
      const block = stack.pop();
      if (block) block.end = re.lastIndex;
    }
  }
  return blocks.filter((b) => b.end > b.start);
}

/** Trechos do bloco que pertencem só a ele (exclui os <ITEM> aninhados). */
function ownRanges(block) {
  const ranges = [];
  let pos = block.start;
  for (const child of block.children) {
    if (child.start > pos) ranges.push([pos, child.start]);
    pos = child.end;
  }
  if (block.end > pos) ranges.push([pos, block.end]);
  return ranges;
}

function ownText(xml, block) {
  return ownRanges(block).map(([s, e]) => xml.slice(s, e)).join("");
}

function ownUniqueId(xml, block) {
  const fromEl = ownText(xml, block).match(/<UNIQUE_ID\b[^>]*\bCODIGO\s*=\s*"([^"]*)"/i)?.[1];
  const fromAttr = readAttr(block.openTag, "UNIQUE_ID");
  return String(fromEl ?? fromAttr ?? "").trim();
}

function normalizeRefs(ids, targetRefs) {
  const refs = Array.isArray(targetRefs) && targetRefs.length
    ? targetRefs
    : (Array.isArray(ids) ? ids.map((id) => ({ id })) : []);
  const seen = new Set();
  return refs
    .map((r) => ({
      id: String(r?.id ?? "").trim(),
      uniqueId: r?.uniqueId != null && String(r.uniqueId).trim() !== "" ? String(r.uniqueId).trim() : "",
      path: Array.isArray(r?.path) && r.path.length && r.path.every((index) => Number.isInteger(index) && index >= 0)
        ? r.path
        : null,
    }))
    .filter((r) => {
      if (!r.id) return false;
      const key = `${r.id}|${r.uniqueId}|${r.path ? r.path.join(".") : ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Encontra exatamente os nós pedidos (id + uniqueId). Nunca cai em "todos com o mesmo ID":
 * se o ref não tem uniqueId e o ID aparece em mais de um nó, devolve em `ambiguous`.
 */
function findExactBlocks(xml, refs) {
  const all = scanItemBlocks(xml);
  const found = [];
  const ambiguous = [];
  const missing = [];
  const taken = new Set();
  for (const ref of refs) {
    const byId = all.filter((b) => (readAttr(b.openTag, "ID") || "").trim() === ref.id);
    let matches;
    if (ref.path) {
      const roots = all.filter((b) => !b.parent);
      let block = roots[ref.path[0]];
      for (const index of ref.path.slice(1)) block = block?.children[index];
      matches = block && byId.includes(block) ? [block] : [];
      if (matches.length && ref.uniqueId && ownUniqueId(xml, matches[0]) !== ref.uniqueId) matches = [];
    } else {
      matches = ref.uniqueId ? byId.filter((b) => ownUniqueId(xml, b) === ref.uniqueId) : byId;
    }
    if (matches.length === 0) { missing.push(ref); continue; }
    if (!ref.uniqueId && matches.length > 1) { ambiguous.push(ref); continue; }
    for (const b of matches) {
      if (taken.has(b.start)) continue;
      taken.add(b.start);
      found.push(b);
    }
  }
  return { blocks: found, ambiguous, missing };
}

function applyRangeEdits(xml, edits) {
  let out = xml;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/** Aplica fn(openTag) -> novo openTag apenas na tag de abertura de cada bloco. */
function editOpenTags(xml, blocks, fn) {
  const edits = blocks.map((b) => ({ start: b.start, end: b.openEnd, text: fn(b.openTag, b) }));
  return applyRangeEdits(xml, edits);
}

function failure(res) {
  if (res.ambiguous.length) return { ok: false, message: "ambiguous-target", ambiguous: res.ambiguous };
  if (!res.blocks.length) return { ok: false, message: "no-match", missing: res.missing };
  return null;
}

function countsOf(blocks) {
  const counts = {};
  for (const b of blocks) {
    const id = readAttr(b.openTag, "ID") || "";
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

/** Descrição: só o atributo DESCRICAO dos nós alvo (ex.: pai + filho). */
function replaceDescriptionExact(xml, refs, newDescription) {
  const res = findExactBlocks(xml, refs);
  const fail = failure(res);
  if (fail) return fail;
  const value = escapeXmlAttr(newDescription);
  const out = editOpenTags(xml, res.blocks, (tag) => setAttr(tag, "DESCRICAO", value));
  return { ok: true, xml: out, counts: countsOf(res.blocks), count: res.blocks.length };
}

/** Código: ITEM_BASE / REFERENCIA (e PRICE, como já era) somente do nó selecionado. */
function replaceCodeExact(xml, refs, newCode) {
  const res = findExactBlocks(xml, refs);
  const fail = failure(res);
  if (fail) return fail;
  const value = escapeXmlAttr(newCode);
  const out = editOpenTags(xml, res.blocks, (tag) => {
    let t = setAttr(tag, "REFERENCIA", value);
    t = setAttr(t, "ITEM_BASE", value);
    if (/\bPRICE\s*=\s*"[^"]*"/i.test(t)) t = setAttr(t, "PRICE", value);
    return t;
  });
  return { ok: true, xml: out, counts: countsOf(res.blocks), count: res.blocks.length };
}

function updateResposta(chunk, tagName, codigo, nova) {
  const regex = new RegExp(`<${tagName}\\b([^>]*?\\bCODIGO\\s*=\\s*"${codigo}"[^>]*?)\\/?>`, "gi");
  return chunk.replace(regex, (fullTag) => {
    const resp = /\bRESPOSTA\s*=\s*"([^"]*)"/i;
    if (resp.test(fullTag)) return fullTag.replace(resp, () => `RESPOSTA="${nova}"`);
    return fullTag.replace(/(\s*\/?>)$/, (m) => ` RESPOSTA="${nova}"${m}`);
  });
}

/**
 * Dimensão: cada nó alvo (pai, filho, chapa) recebe o MESMO L x A x P no seu próprio conteúdo.
 * Componentes internos que não são alvo ficam intactos.
 */
function replaceDimensionExact(xml, refs, dim) {
  const { l, a, p } = dim;
  const res = findExactBlocks(xml, refs);
  const fail = failure(res);
  if (fail) return fail;

  const edits = [];
  for (const block of res.blocks) {
    const ranges = ownRanges(block);
    const own = ownText(xml, block);
    const hasEspessura =
      /<CARACTERISTICA\b[^>]*\bCODIGO\s*=\s*"ESPESSURA"/i.test(own) ||
      /<COLUNA\b[^>]*\bCODIGO\s*=\s*"ESPESSURA"/i.test(own);
    const alt2d = hasEspessura ? p : a;
    const espessura = a;

    ranges.forEach(([s, e], idx) => {
      let text = xml.slice(s, e);
      let head = "";
      if (idx === 0) {
        head = text.slice(0, block.openEnd - block.start);
        text = text.slice(head.length);
        head = setAttr(setAttr(setAttr(head, "LARGURA", l), "ALTURA", a), "PROFUNDIDADE", p);
      }
      text = updateResposta(text, "CARACTERISTICA", "LARGURA", l);
      text = updateResposta(text, "CARACTERISTICA", "ALTURA", alt2d);
      text = updateResposta(text, "CARACTERISTICA", "PROFUNDIDADE", p);
      text = updateResposta(text, "OTIMIZACAO", "LARGURA_CORTE", l);
      text = updateResposta(text, "OTIMIZACAO", "ALTURA_CORTE", alt2d);
      text = updateResposta(text, "COLUNA", "LARGURA", l);
      text = updateResposta(text, "COLUNA", "ALTURA", alt2d);
      text = updateResposta(text, "COLUNA", "PROFUNDIDADE", p);
      if (hasEspessura) {
        text = updateResposta(text, "CARACTERISTICA", "ESPESSURA", espessura);
        text = updateResposta(text, "CARACTERISTICA", "THICKNESS_PLATECUTTING", String(Math.round(parseFloat(a)) || a));
        text = updateResposta(text, "COLUNA", "ESPESSURA", espessura);
      }
      edits.push({ start: s, end: e, text: head + text });
    });
  }
  return { ok: true, xml: applyRangeEdits(xml, edits), counts: countsOf(res.blocks), count: res.blocks.length };
}

module.exports = {
  normalizeRefs,
  findExactBlocks,
  replaceDescriptionExact,
  replaceCodeExact,
  replaceDimensionExact,
};
