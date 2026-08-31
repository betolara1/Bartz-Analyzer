// main/xml-editor.js
// Ferramentas de edição manual de um XML já processado: substituir cor coringa,
// grupos CG1/CG2, preencher REFERENCIA vazia, trocar DESCRICAO — todas com
// backup automático (para desfazer) e reprocessamento do arquivo ao final.
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const { ipcMain } = require("electron");
const state = require("./state");
const {
  loadCfg,
  send,
  resolveFilePathMaybeBase,
  escapeRegExp,
  readReplaceHistory,
  writeReplaceHistory,
  appendReplaceHistory,
} = require("./helpers");
const { processOne, validateXml } = require("./xml-processor");

/** --- replace a detected cor coringa in the given file (creates backup + history) --- **/
ipcMain.handle("analyzer:replaceCoringa", async (_e, obj) => {
  try {
    const { filePath, from, to } = obj || {};
    if (!filePath || !from || typeof to === 'undefined') { send('error', { where: 'replaceCoringa', message: 'Parâmetros inválidos.' }); return { ok: false, message: 'invalid-params' }; }

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) { send('error', { where: 'replaceCoringa', message: 'Arquivo não encontrado.' }); return { ok: false, message: 'not-found' }; }

    // read original
    const raw = await fsp.readFile(real, 'utf8');

    const re = new RegExp(`\\b${escapeRegExp(String(from))}\\b`, 'gi');
    let count = 0;
    const replaced = raw.replace(re, (m) => { count++; return String(to); });
    if (count === 0) return { ok: false, message: 'no-match' };

    // garantir diretório de backup e escrever cópia de backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i, '')}_backup_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continuar mesmo se backup falhar */ }

    // escrever conteúdo substituído
    await fsp.writeFile(real, replaced, 'utf8');

    // adicionar entrada ao histórico
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath: backupPath,
      timestamp: new Date().toISOString(),
      from: String(from),
      to: String(to),
      replaced: count,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // reprocessar arquivo atualizado (vai revalidar e mover se necessário)
    try { await processOne(real, cfg); } catch (e) { /* ignorar */ }

    return { ok: true, replaced: count, backupPath };
  } catch (e) {
    send('error', { where: 'replaceCoringa', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- undo last replace for a given file --- **/
ipcMain.handle('analyzer:undoReplace', async (_e, obj) => {
  try {
    const { filePath } = obj || {};
    if (!filePath) return { ok: false, message: 'invalid-params' };
    const real = path.resolve(filePath);
    const hist = await readReplaceHistory();
    // encontrar última entrada correspondente para este arquivo que não foi desfeita
    for (let i = hist.length - 1; i >= 0; i--) {
      const en = hist[i];
      if (!en || en.undone) continue;
      // corresponder caminho exato ou mesmo nome base (caso arquivo foi movido após processamento)
      if (path.resolve(en.file) === real || path.basename(en.file) === path.basename(real)) {
        const backup = en.backupPath;
        if (!backup || !(await fse.pathExists(backup))) return { ok: false, message: 'backup-not-found' };
        // restaurar
        try { await fse.copy(backup, real, { overwrite: true }); } catch (e) { return { ok: false, message: 'restore-failed' }; }
        // marcar desfeito
        hist[i].undone = true;
        await writeReplaceHistory(hist);
        // reprocessar
        try { await processOne(real, state.currentCfg || await loadCfg()); } catch (e) { /* ignorar */ }
        return { ok: true, restored: true, entry: hist[i] };
      }
    }
    return { ok: false, message: 'no-history' };
  } catch (e) {
    send('error', { where: 'undoReplace', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- replace all CG1/CG2 occurrences in a file according to provided map --- **/
ipcMain.handle('analyzer:replaceCgGroups', async (_e, obj) => {
  try {
    const { filePath, map } = obj || {};
    if (!filePath || !map || (typeof map !== 'object')) { return { ok: false, message: 'invalid-params' }; }

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) return { ok: false, message: 'not-found' };

    const raw = await fsp.readFile(real, 'utf8');
    let replacedText = raw;
    const counts = {};
    // aplicar substituições para chaves conhecidas (cg1, cg2) -- case-insensitive
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = map[key];
      if (!val) { counts[key] = 0; continue; }
      const re = new RegExp(escapeRegExp(key.toString()), 'gi');
      let c = 0;
      replacedText = replacedText.replace(re, (m) => { c++; return String(val); });
      counts[key] = c;
    }

    const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    if (total === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i, '')}_backup_cg_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continuar */ }

    // escrever substituído
    await fsp.writeFile(real, replacedText, 'utf8');

    // entrada do histórico
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'cg-groups',
      map,
      counts,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // reprocessar
    try { await processOne(real, cfg); } catch (e) { /* ignorar */ }

    return { ok: true, counts, backupPath };
  } catch (e) {
    send('error', { where: 'replaceCgGroups', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- fill empty REFERENCIA attributes (REFERENCIA="" -> REFERENCIA="<value>") --- **/
ipcMain.handle('analyzer:fillReferencia', async (_e, obj) => {
  try {
    const { filePath, value } = obj || {};
    if (!filePath || typeof value === 'undefined') return { ok: false, message: 'invalid-params' };

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) return { ok: false, message: 'not-found' };

    const raw = await fsp.readFile(real, 'utf8');
    const re = /\bREFERENCIA\s*=\s*""/gi;
    let count = 0;
    const replaced = raw.replace(re, (m) => { count++; return `REFERENCIA="${String(value)}"`; });
    if (count === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i, '')}_backup_ref_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    await fsp.writeFile(real, replaced, 'utf8');

    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'fill-referencia',
      value: String(value),
      replaced: count,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignore */ }

    try { await processOne(real, cfg); } catch (e) { /* ignore */ }

    return { ok: true, replaced: count, backupPath };
  } catch (e) {
    send('error', { where: 'fillReferencia', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- preencher REFERENCIA apenas para IDs específicas de ITEM --- **/
ipcMain.handle('analyzer:fillReferenciaByIds', async (_e, obj) => {
  try {
    const { filePath, replacements } = obj || {};
    // replacements: [{ id: string, value: string }, ...]
    if (!filePath || !Array.isArray(replacements) || replacements.length === 0) return { ok: false, message: 'invalid-params' };

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) return { ok: false, message: 'not-found' };

    let raw = await fsp.readFile(real, 'utf8');
    const counts = {};

    for (const rep of replacements) {
      const id = rep?.id;
      const value = rep?.value;
      if (!id || typeof value === 'undefined') { counts[id] = 0; continue; }

      // Encontrar a tag ITEM com ID correspondente e substituir REFERENCIA dentro dela
      // FIX CRÍTICO: Não usar [\s\S]*? sem terminação apropriada
      // Em vez disso, corresponder apenas até /> ou fechamento >
      const escapedId = escapeRegExp(String(id));

      // Este regex lida adequadamente com tags multi-linha ao:
      // 1. Começar com <ITEM
      // 2. Usar [^<]* para corresponder atributos (qualquer coisa exceto outra tag)
      // 3. Permitir quebras de linha nos atributos com \s explícito
      // 4. Corresponder atributo ID
      // 5. Corresponder resto dos atributos até > ou />
      const itemRegex = new RegExp(`<ITEM(?:[^<]|\\n)*?ID\\s*=\\s*"${escapedId}"(?:[^<]|\\n)*?(?:>|/>)`, 'gi');

      let c = 0;
      const originalRaw = raw; // Guardar para debug
      raw = raw.replace(itemRegex, (itemMatch) => {
        // Se foi passada uma descrição, verifica se bate (para lidar com duplicados de ID)
        if (rep.descricao) {
          const mDesc = itemMatch.match(/\bDESCRICAO\s*=\s*"([^"]*)"/i);
          const currentDesc = mDesc ? mDesc[1] : "";
          if (currentDesc !== rep.descricao) return itemMatch;
        }

        // Passo 2: Substituir REFERENCIA dentro dessa tag ITEM específica
        // APENAS se estiver vazia ou não existir
        let updated = itemMatch;
        const refAttrRegex = /REFERENCIA\s*=\s*"([^"]*)"/i;
        const matchRef = updated.match(refAttrRegex);

        if (matchRef) {
          const currentRef = matchRef[1] || "";
          // Só substitui se estiver vazio
          if (currentRef.trim() === "") {
            updated = updated.replace(refAttrRegex, `REFERENCIA="${String(value)}"`);
            c++;
          }
        } else {
          // Atributo REFERENCIA não existe, adiciona antes do fechamento
          updated = updated.replace(/[\s\S]*?>/, (match) => {
            return match.replace(/[\s\n]*>/, ` REFERENCIA="${String(value)}"`);
          });
          c++;
        }

        // Se uma nova descrição foi informada (ou alterada), substitui no atributo DESCRICAO
        const newDesc = rep.newDesc || rep.novaDescricao;
        if (newDesc && typeof newDesc === 'string' && newDesc.trim() !== '') {
          const descAttrRegex = /DESCRICAO\s*=\s*"([^"]*)"/i;
          if (updated.match(descAttrRegex)) {
            updated = updated.replace(descAttrRegex, `DESCRICAO="${String(newDesc).trim()}"`);
          } else {
            updated = updated.replace(/[\s\S]*?>/, (match) => {
              return match.replace(/[\s\n]*>/, ` DESCRICAO="${String(newDesc).trim()}"`);
            });
          }
        }

        return updated;
      });

      counts[id] = c;

      if (c === 0) {
        // Nenhuma correspondência encontrada
      }
    }

    const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    if (total === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i, '')}_backup_refids_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    // escrever arquivo
    await fsp.writeFile(real, raw, 'utf8');

    // Verificar se foi escrito
    const writtenContent = await fsp.readFile(real, 'utf8');

    // history
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'fill-referencia-ids',
      replacements,
      counts,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // Reprocessar arquivo (isso também o moverá se necessário)
    // Mas precisamos rastrear o novo caminho se ele se mover
    let finalPath = path.resolve(real);
    const originalPath = finalPath; // Guardar caminho original para limpeza
    try {
      const analysis = await validateXml(real, cfg);
      const isOK = (analysis.erros || []).length === 0;
      const baseName = path.basename(real);
      const destDir = isOK ? (cfg.ok || cfg.exportacao) : (cfg.erro || cfg.exportacao);

      if (destDir) {
        await fse.ensureDir(destDir);
        const target = path.join(destDir, baseName);
        if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
          try {
            await fse.move(finalPath, target, { overwrite: true });
            finalPath = path.resolve(target);

            // DELETAR arquivo antigo de ERRO se foi movido para OK
            if (isOK && originalPath.toLowerCase() !== finalPath.toLowerCase()) {
              try {
                await fse.remove(originalPath);
              } catch (delErr) {
                // Falha ao deletar é aceitável
              }
            }
          } catch { }
        }
      }

      send('file-validated', { ...analysis, arquivo: finalPath });
    } catch (e) {
      send('error', { where: 'fillReferenciaByIds-processOne', message: String(e?.message || e) });
    }

    return { ok: true, counts, backupPath, arquivo: finalPath };
  } catch (e) {
    send('error', { where: 'fillReferenciaByIds', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- replace DESCRICAO attribute for specific ITEM IDs --- **/
ipcMain.handle('analyzer:replaceItemDescription', async (_e, obj) => {
  try {
    const { filePath, ids, newDescription, desenho } = obj || {};
    if (!filePath || !Array.isArray(ids) || ids.length === 0 || typeof newDescription !== 'string') {
      send('error', { where: 'replaceItemDescription', message: 'Parâmetros inválidos.' });
      return { ok: false, message: 'invalid-params' };
    }

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) {
      send('error', { where: 'replaceItemDescription', message: 'Arquivo não encontrado.' });
      return { ok: false, message: 'not-found' };
    }

    let raw = await fsp.readFile(real, 'utf8');
    const counts = {};

    for (const id of ids) {
      if (!id) continue;

      // Step 1: Build the itemRegex targeting by ID (unique identifier in XML)
      const escapedId = escapeRegExp(String(id));
      const itemRegex = new RegExp(`<ITEM(?:[^<]|\\n)*?ID\\s*=\\s*"${escapedId}"(?:[^<]|\\n)*?(?:>|/>)`, 'gi');

      let oldDesc = "";
      let itemDrawing = desenho || "";

      // Step 2: Find the old description and drawing from the correct item tag
      const matchItems = raw.match(itemRegex) || [];
      let matchedItemTag = "";

      if (desenho) {
        for (const itemTag of matchItems) {
          const desenhoAttrRegex = /DESENHO\s*=\s*"([^"]*)"/i;
          const matchDes = itemTag.match(desenhoAttrRegex);
          if (matchDes && matchDes[1] === desenho) {
            matchedItemTag = itemTag;
            break;
          }
        }
      }

      if (!matchedItemTag && matchItems.length > 0) {
        matchedItemTag = matchItems[0];
      }

      if (matchedItemTag) {
        const descAttrRegex = /DESCRICAO\s*=\s*"([^"]*)"/i;
        const matchDesc = matchedItemTag.match(descAttrRegex);
        if (matchDesc) {
          oldDesc = matchDesc[1];
        }

        if (!itemDrawing) {
          const desenhoAttrRegex = /DESENHO\s*=\s*"([^"]*)"/i;
          const matchDesenho = matchedItemTag.match(desenhoAttrRegex);
          if (matchDesenho) {
            itemDrawing = matchDesenho[1];
          }
        }
      }

      let c = 0;

      // Step 3: Replace DESCRICAO on the correct ITEM tag
      raw = raw.replace(itemRegex, (itemMatch) => {
        if (desenho) {
          const desenhoAttrRegex = /DESENHO\s*=\s*"([^"]*)"/i;
          const matchDes = itemMatch.match(desenhoAttrRegex);
          const currentDesenho = matchDes ? matchDes[1] : "";
          if (currentDesenho !== desenho) {
            return itemMatch;
          }
        }

        let updated = itemMatch;
        const descAttrRegex = /DESCRICAO\s*=\s*"([^"]*)"/i;
        const matchDesc = updated.match(descAttrRegex);

        if (matchDesc) {
          updated = updated.replace(descAttrRegex, `DESCRICAO="${String(newDescription)}"`);
          c++;
        } else {
          updated = updated.replace(/[\s\S]*?>/, (match) => {
            return match.replace(/[\s\n]*>/, ` DESCRICAO="${String(newDescription)}"`);
          });
          c++;
        }
        return updated;
      });

      // Step 4: If we found an old description, replace `<COLUNA CODIGO="PartName" RESPOSTA="..." />` ONLY inside corresponding `<SETUP>` blocks
      if (oldDesc) {
        if (itemDrawing) {
          const escapedDesenho = escapeRegExp(itemDrawing);
          const setupRegex = /<SETUP\b[\s\S]*?<\/SETUP>/gi;

          raw = raw.replace(setupRegex, (setupBlock) => {
            const hasDrawing = new RegExp(`\\b${escapedDesenho}\\b`, 'i').test(setupBlock);
            if (hasDrawing) {
              const escapedOldDesc = escapeRegExp(oldDesc.trim());
              const partNameRegex = new RegExp(`<COLUNA\\s+CODIGO\\s*=\\s*"PartName"\\s+RESPOSTA\\s*=\\s*"\\s*${escapedOldDesc}\\s*"\\s*/>`, 'gi');

              return setupBlock.replace(partNameRegex, () => {
                c++;
                return `<COLUNA CODIGO="PartName" RESPOSTA="${String(newDescription)}" />`;
              });
            }
            return setupBlock;
          });
        } else {
          // Fallback globally if no drawing code is found
          const escapedOldDesc = escapeRegExp(oldDesc.trim());
          const partNameRegex = new RegExp(`<COLUNA\\s+CODIGO\\s*=\\s*"PartName"\\s+RESPOSTA\\s*=\\s*"\\s*${escapedOldDesc}\\s*"\\s*/>`, 'gi');

          raw = raw.replace(partNameRegex, () => {
            c++;
            return `<COLUNA CODIGO="PartName" RESPOSTA="${String(newDescription)}" />`;
          });
        }
      }

      counts[id] = c;
    }

    const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    if (total === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i, '')}_backup_desc_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    // escrever arquivo
    await fsp.writeFile(real, raw, 'utf8');

    // history
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'replace-description',
      ids,
      newDescription,
      counts,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // Reprocessar arquivo
    let finalPath = path.resolve(real);
    const originalPath = finalPath;
    try {
      const analysis = await validateXml(real, cfg);
      const isOK = (analysis.erros || []).length === 0;
      const baseName = path.basename(real);
      const destDir = isOK ? (cfg.ok || cfg.exportacao) : (cfg.erro || cfg.exportacao);

      if (destDir) {
        await fse.ensureDir(destDir);
        const target = path.join(destDir, baseName);
        if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
          try {
            await fse.move(finalPath, target, { overwrite: true });
            finalPath = path.resolve(target);

            if (isOK && originalPath.toLowerCase() !== finalPath.toLowerCase()) {
              try {
                await fse.remove(originalPath);
              } catch (delErr) { }
            }
          } catch { }
        }
      }

      send('file-validated', { ...analysis, arquivo: finalPath });
    } catch (e) {
      send('error', { where: 'replaceItemDescription-processOne', message: String(e?.message || e) });
    }

    return { ok: true, counts, backupPath, arquivo: finalPath };
  } catch (e) {
    send('error', { where: 'replaceItemDescription', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- replace LARGURA, ALTURA, PROFUNDIDADE attributes for specific ITEM IDs --- **/
ipcMain.handle('analyzer:replaceItemDimension', async (_e, obj) => {
  try {
    const { filePath, ids, newDimension, desenho } = obj || {};
    if (!filePath || !Array.isArray(ids) || ids.length === 0 || !newDimension) {
      send('error', { where: 'replaceItemDimension', message: 'Parâmetros inválidos.' });
      return { ok: false, message: 'invalid-params' };
    }

    let l = "", a = "", p = "";
    if (typeof newDimension === 'object' && newDimension !== null) {
      l = String(newDimension.largura ?? newDimension.l ?? "").trim();
      a = String(newDimension.altura ?? newDimension.a ?? "").trim();
      p = String(newDimension.profundidade ?? newDimension.p ?? "").trim();
    } else if (typeof newDimension === 'string') {
      const parts = newDimension.toLowerCase().split(/[x*]/).map(s => s.trim());
      if (parts.length >= 3) {
        l = parts[0];
        a = parts[1];
        p = parts[2];
      }
    }

    if (!l || !a || !p) {
      send('error', { where: 'replaceItemDimension', message: 'Dimensão inválida (necessário Largura, Altura e Profundidade).' });
      return { ok: false, message: 'invalid-dimension' };
    }

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) {
      send('error', { where: 'replaceItemDimension', message: 'Arquivo não encontrado.' });
      return { ok: false, message: 'not-found' };
    }

    let raw = await fsp.readFile(real, 'utf8');
    const counts = {};

    const setAttr = (tagStr, attrName, attrValue) => {
      const attrRegex = new RegExp(`\\b${attrName}\\s*=\\s*"([^"]*)"`, 'i');
      if (tagStr.match(attrRegex)) {
        return tagStr.replace(attrRegex, `${attrName}="${attrValue}"`);
      }
      return tagStr.replace(/(\s*\/?>)$/, (m) => ` ${attrName}="${attrValue}"${m.startsWith(' ') ? m : ' ' + m}`);
    };

    // Helper: update RESPOSTA attribute on tags matched by CODIGO
    const updateResposta = (xmlChunk, tagName, codigoValue, newResposta) => {
      const escapedCod = escapeRegExp(codigoValue);
      const regex = new RegExp(`<${tagName}\\b([^>]*?\\bCODIGO\\s*=\\s*"${escapedCod}"[^>]*?)\\/?>`, 'gi');
      return xmlChunk.replace(regex, (fullTag) => {
        const respRegex = /\bRESPOSTA\s*=\s*"([^"]*)"/i;
        if (fullTag.match(respRegex)) {
          return fullTag.replace(respRegex, `RESPOSTA="${newResposta}"`);
        }
        return fullTag.replace(/(\s*\/?>)$/, ` RESPOSTA="${newResposta}"$1`);
      });
    };

    for (const id of ids) {
      if (!id) continue;

      const escapedId = escapeRegExp(String(id));
      let c = 0;

      // Find each opening <ITEM ... ID="xxx" ...> tag
      const openTagRegex = new RegExp(`<ITEM\\b(?=[^>]*\\bID\\s*=\\s*"${escapedId}")[^>]*>`, 'gi');
      let match;
      const itemBlocks = [];

      while ((match = openTagRegex.exec(raw)) !== null) {
        const startIdx = match.index;
        const openTag = match[0];

        // Filter by DESENHO if specified
        if (desenho) {
          const mDes = openTag.match(/\bDESENHO\s*=\s*"([^"]*)"/i);
          if (mDes && mDes[1] !== desenho) continue;
        }

        // Self-closing tag
        if (openTag.endsWith('/>')) {
          itemBlocks.push({ startIdx, endIdx: startIdx + openTag.length, block: openTag });
          continue;
        }

        // Find matching </ITEM> respecting nesting
        let depth = 1;
        const tagRegex = /<(\/?)ITEM\b([^>]*?)(\/?)>/gi;
        tagRegex.lastIndex = startIdx + openTag.length;
        let tagMatch;
        let foundEnd = false;

        while ((tagMatch = tagRegex.exec(raw)) !== null) {
          const isClose = tagMatch[1] === '/';
          const isSelfClose = tagMatch[3] === '/';
          if (isClose) {
            depth--;
            if (depth === 0) {
              const endIdx = tagMatch.index + tagMatch[0].length;
              itemBlocks.push({ startIdx, endIdx, block: raw.substring(startIdx, endIdx) });
              foundEnd = true;
              break;
            }
          } else if (!isSelfClose) {
            depth++;
          }
        }

        if (!foundEnd) {
          itemBlocks.push({ startIdx, endIdx: startIdx + openTag.length, block: openTag });
        }
      }

      // Process from back to front to preserve string indices
      itemBlocks.sort((a, b) => b.startIdx - a.startIdx);

      for (const blockInfo of itemBlocks) {
        let block = blockInfo.block;

        // 1. Update the main <ITEM> opening tag attributes
        const openMatch = block.match(/^<ITEM\b[^>]*>/i);
        if (openMatch) {
          let updatedOpen = openMatch[0];
          updatedOpen = setAttr(updatedOpen, 'LARGURA', l);
          updatedOpen = setAttr(updatedOpen, 'ALTURA', a);
          updatedOpen = setAttr(updatedOpen, 'PROFUNDIDADE', p);
          block = updatedOpen + block.slice(openMatch[0].length);
        }

        // Detect ESPESSURA (doors/panels where ALTURA 2D = PROFUNDIDADE)
        const hasEspessura = /<CARACTERISTICA\b[^>]*\bCODIGO\s*=\s*"ESPESSURA"/i.test(block) ||
                             /<COLUNA\b[^>]*\bCODIGO\s*=\s*"ESPESSURA"/i.test(block);

        const alt2dValue = hasEspessura ? p : a;
        const espessuraValue = a;

        // 2. Update <CONFIGURADO> section
        block = updateResposta(block, 'CARACTERISTICA', 'LARGURA', l);
        block = updateResposta(block, 'CARACTERISTICA', 'ALTURA', alt2dValue);
        block = updateResposta(block, 'CARACTERISTICA', 'PROFUNDIDADE', p);
        if (hasEspessura) {
          block = updateResposta(block, 'CARACTERISTICA', 'ESPESSURA', espessuraValue);
          block = updateResposta(block, 'CARACTERISTICA', 'THICKNESS_PLATECUTTING', String(Math.round(parseFloat(a)) || a));
        }

        // 3. Update <OTIMIZACAO_CORTE> section
        block = updateResposta(block, 'OTIMIZACAO', 'LARGURA_CORTE', l);
        block = updateResposta(block, 'OTIMIZACAO', 'ALTURA_CORTE', alt2dValue);

        // 4. Update <COLUNAS> section (inside SETUP)
        block = updateResposta(block, 'COLUNA', 'LARGURA', l);
        block = updateResposta(block, 'COLUNA', 'ALTURA', alt2dValue);
        block = updateResposta(block, 'COLUNA', 'PROFUNDIDADE', p);
        if (hasEspessura) {
          block = updateResposta(block, 'COLUNA', 'ESPESSURA', espessuraValue);
        }

        // 5. Update known child <ITEM> tags in <ESTRUTURA> (chapa, EMBALAGEM_FIXO, painel, frente, porta)
        block = block.replace(
          /(<ITEM\b(?=[^>]*\bID\s*=\s*"(?:chapa|EMBALAGEM_FIXO|painel|frente|porta)"[^>]*)[^>]*>)/gi,
          (childTag) => {
            let u = childTag;
            u = setAttr(u, 'LARGURA', l);
            u = setAttr(u, 'ALTURA', a);
            u = setAttr(u, 'PROFUNDIDADE', p);
            return u;
          }
        );

        // Replace in raw
        raw = raw.substring(0, blockInfo.startIdx) + block + raw.substring(blockInfo.endIdx);
        c++;
      }

      counts[id] = c;
    }

    const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    if (total === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\\.xml$/i, '')}_backup_dim_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    // escrever arquivo
    await fsp.writeFile(real, raw, 'utf8');

    // history
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'replace-dimension',
      ids,
      newDimension: `${l}x${a}x${p}`,
      counts,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // Reprocessar arquivo
    let finalPath = path.resolve(real);
    const originalPath = finalPath;
    try {
      const analysis = await validateXml(real, cfg);
      const isOK = (analysis.erros || []).length === 0;
      const baseName = path.basename(real);
      const destDir = isOK ? (cfg.ok || cfg.exportacao) : (cfg.erro || cfg.exportacao);

      if (destDir) {
        await fse.ensureDir(destDir);
        const target = path.join(destDir, baseName);
        if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
          try {
            await fse.move(finalPath, target, { overwrite: true });
            finalPath = path.resolve(target);

            if (isOK && originalPath.toLowerCase() !== finalPath.toLowerCase()) {
              try {
                await fse.remove(originalPath);
              } catch (delErr) { }
            }
          } catch { }
        }
      }

      send('file-validated', { ...analysis, arquivo: finalPath });
    } catch (e) {
      send('error', { where: 'replaceItemDimension-processOne', message: String(e?.message || e) });
    }

    return { ok: true, counts, backupPath, arquivo: finalPath };
  } catch (e) {
    send('error', { where: 'replaceItemDimension', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- delete ITEM (and its entire subtree if parent) from XML --- **/
ipcMain.handle('analyzer:deleteItem', async (_e, obj) => {
  try {
    const { filePath, id, desenho, isParent } = obj || {};
    if (!filePath || !id) {
      return { ok: false, message: 'Parâmetros inválidos.' };
    }

    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) {
      send('error', { where: 'deleteItem', message: 'Arquivo não encontrado.' });
      return { ok: false, message: 'not-found' };
    }

    let raw = await fsp.readFile(real, 'utf8');
    let deletedCount = 0;

    const escapedId = escapeRegExp(String(id));

    // Find the opening <ITEM ... ID="xxx" ...> tag
    const openTagRegex = new RegExp(`<ITEM\\b(?=[^>]*\\bID\\s*=\\s*"${escapedId}")[^>]*>`, 'gi');
    let match;
    const blocksToRemove = [];

    while ((match = openTagRegex.exec(raw)) !== null) {
      const startIdx = match.index;
      const openTag = match[0];

      // Filter by DESENHO if specified
      if (desenho) {
        const mDes = openTag.match(/\bDESENHO\s*=\s*"([^"]*)"/i);
        if (mDes && mDes[1] !== desenho) continue;
      }

      // Self-closing tag - just remove the tag line
      if (openTag.endsWith('/>')) {
        // Also remove trailing newline/whitespace
        let endIdx = startIdx + openTag.length;
        while (endIdx < raw.length && (raw[endIdx] === '\r' || raw[endIdx] === '\n')) endIdx++;
        // Remove leading whitespace on the same line
        let startAdj = startIdx;
        while (startAdj > 0 && raw[startAdj - 1] === ' ') startAdj--;
        blocksToRemove.push({ startIdx: startAdj, endIdx });
        continue;
      }

      if (isParent) {
        // Find matching </ITEM> respecting nesting for parent items
        let depth = 1;
        const tagRegex = /<(\/?)ITEM\b([^>]*?)(\/?)>/gi;
        tagRegex.lastIndex = startIdx + openTag.length;
        let tagMatch;

        while ((tagMatch = tagRegex.exec(raw)) !== null) {
          const isClose = tagMatch[1] === '/';
          const isSelfClose = tagMatch[3] === '/';
          if (isClose) {
            depth--;
            if (depth === 0) {
              let endIdx = tagMatch.index + tagMatch[0].length;
              while (endIdx < raw.length && (raw[endIdx] === '\r' || raw[endIdx] === '\n')) endIdx++;
              let startAdj = startIdx;
              while (startAdj > 0 && raw[startAdj - 1] === ' ') startAdj--;
              blocksToRemove.push({ startIdx: startAdj, endIdx });
              break;
            }
          } else if (!isSelfClose) {
            depth++;
          }
        }
      } else {
        // Child item with content: still find full block
        let depth = 1;
        const tagRegex = /<(\/?)ITEM\b([^>]*?)(\/?)>/gi;
        tagRegex.lastIndex = startIdx + openTag.length;
        let tagMatch;
        let foundEnd = false;

        while ((tagMatch = tagRegex.exec(raw)) !== null) {
          const isClose = tagMatch[1] === '/';
          const isSelfClose = tagMatch[3] === '/';
          if (isClose) {
            depth--;
            if (depth === 0) {
              let endIdx = tagMatch.index + tagMatch[0].length;
              while (endIdx < raw.length && (raw[endIdx] === '\r' || raw[endIdx] === '\n')) endIdx++;
              let startAdj = startIdx;
              while (startAdj > 0 && raw[startAdj - 1] === ' ') startAdj--;
              blocksToRemove.push({ startIdx: startAdj, endIdx });
              foundEnd = true;
              break;
            }
          } else if (!isSelfClose) {
            depth++;
          }
        }

        if (!foundEnd) {
          // Fallback: just remove the opening tag
          let endIdx = startIdx + openTag.length;
          while (endIdx < raw.length && (raw[endIdx] === '\r' || raw[endIdx] === '\n')) endIdx++;
          let startAdj = startIdx;
          while (startAdj > 0 && raw[startAdj - 1] === ' ') startAdj--;
          blocksToRemove.push({ startIdx: startAdj, endIdx });
        }
      }
    }

    if (blocksToRemove.length === 0) {
      return { ok: false, message: 'no-match' };
    }

    // Remove from back to front to preserve indices
    blocksToRemove.sort((a, b) => b.startIdx - a.startIdx);
    for (const block of blocksToRemove) {
      raw = raw.substring(0, block.startIdx) + raw.substring(block.endIdx);
      deletedCount++;
    }

    // backup
    await fse.ensureDir(state.REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i, '')}_backup_del_${Date.now()}.xml`;
    const backupPath = path.join(state.REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    // write
    await fsp.writeFile(real, raw, 'utf8');

    // history
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'delete-item',
      itemId: id,
      desenho: desenho || null,
      deletedCount,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // Reprocess file
    let finalPath = path.resolve(real);
    const originalPath = finalPath;
    try {
      const analysis = await validateXml(real, cfg);
      const isOK = (analysis.erros || []).length === 0;
      const baseName = path.basename(real);
      const destDir = isOK ? (cfg.ok || cfg.exportacao) : (cfg.erro || cfg.exportacao);

      if (destDir) {
        await fse.ensureDir(destDir);
        const target = path.join(destDir, baseName);
        if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
          try {
            await fse.move(finalPath, target, { overwrite: true });
            finalPath = path.resolve(target);

            if (isOK && originalPath.toLowerCase() !== finalPath.toLowerCase()) {
              try {
                await fse.remove(originalPath);
              } catch (delErr) { }
            }
          } catch { }
        }
      }

      send('file-validated', { ...analysis, arquivo: finalPath });
    } catch (e) {
      send('error', { where: 'deleteItem-processOne', message: String(e?.message || e) });
    }

    return { ok: true, deletedCount, backupPath, arquivo: finalPath };
  } catch (e) {
    send('error', { where: 'deleteItem', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

