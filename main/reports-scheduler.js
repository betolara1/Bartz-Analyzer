// main/reports-scheduler.js
// Relatório diário (CSV), limpeza automática de pastas configuradas e o
// agendador que dispara ambos nos horários configurados pelo usuário.
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const { app, ipcMain } = require("electron");
const state = require("./state");
const { loadCfg } = require("./helpers");

/**
 * Agrega todos os arquivos processados hoje a partir do histórico persistido.
 */
async function aggregateTodayLogs() {
  const rows = [];
  try {
    if (await fse.pathExists(state.HISTORY_FILE)) {
      const allRows = await fse.readJson(state.HISTORY_FILE);
      if (Array.isArray(allRows)) {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        allRows.forEach(r => {
          if (r.timestamp && r.timestamp.startsWith(todayStr)) {
            rows.push(r);
          }
        });
      }
    }
  } catch (e) {
    console.error('[Scheduler] Erro ao ler HISTORY_FILE:', e.message);
  }
  return { rows };
}

const filterTags = (tags) => {
  if (!tags) return [];
  const norm = (t) => t.trim().toLowerCase().replace(/\s+/g, '_');
  const normalizedTags = tags.map(t => norm(t));

  const autofixBases = new Set();
  normalizedTags.forEach(t => {
    if (t.endsWith('_autofix')) {
      autofixBases.add(t.replace(/_autofix$/, ''));
    } else if (t.endsWith('autofix')) {
      autofixBases.add(t.replace(/autofix$/, ''));
    }
  });

  return tags.filter(t => {
    const n = norm(t);
    if (autofixBases.has(n)) return false;
    if (n.includes('duplado') && Array.from(autofixBases).some(b => b.includes('duplado'))) {
      return false;
    }
    return true;
  });
};

/**
 * Salva o relatório diário (CSV) baseado nos dados fornecidos.
 * Usado tanto via IPC (exportReport) quanto pelo Agendador Automático.
 */
async function saveDailyReport(reportData) {
  console.log('[Report] ========== INICIANDO GERAÇÃO DE RELATÓRIO ==========');

  const cfg = state.currentCfg || (await loadCfg());

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // YYYY-MM-DD

  let dateStr = todayStr;
  if (reportData && reportData.targetDate) {
    dateStr = reportData.targetDate;
  }

  // Obter pasta de exportação da config
  let exportFolder = cfg?.exportacao || "";
  if (!exportFolder || !(await fse.pathExists(exportFolder))) {
    exportFolder = path.join(app.getPath("desktop"), "Bartz-Analyzer_Exports");
    await fse.ensureDir(exportFolder);
  }

  const csvPath = path.join(exportFolder, `Relatorio_${dateStr}.csv`);

  let allFiles = Array.isArray(reportData.rows) ? reportData.rows : [];

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    const targetDayBR = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    allFiles = allFiles.filter(f => f.timestamp && f.timestamp.startsWith(targetDayBR));
  }

  const totalFiles = allFiles.length;
  const okFiles = allFiles.filter(f => f.status === "OK").length;
  const errorFiles = allFiles.filter(f => f.status === "ERRO").length;
  const ferragensFiles = allFiles.filter(f => f.status === "FERRAGENS-ONLY" || f.status === "FERRAGENS").length;

  const normalizeTagForMatch = (t) =>
    (t || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s_]+/g, "");

  const hasCurvo = (r) =>
    (r.tags || []).includes("curvo") ||
    (r.warnings || []).some(w => /curvo/i.test(String(w)));

  const muxarabiFiles = allFiles.filter(f => (f.tags || []).some(t => normalizeTagForMatch(t).includes("muxarabi"))).length;
  const coringaFiles = allFiles.filter(f => (f.tags || []).some(t => normalizeTagForMatch(t).includes("coringa"))).length;
  const dupladoFiles = allFiles.filter(f => (f.tags || []).some(t => normalizeTagForMatch(t).includes("duplado"))).length;
  const semCodigoFiles = allFiles.filter(f => (f.tags || []).some(t => normalizeTagForMatch(t).includes("semcodigo"))).length;
  const curvoFiles = allFiles.filter(hasCurvo).length;
  const autoFixFiles = allFiles.filter(f => (f.autoFixes || []).length > 0).length;

  const formatStatus = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "OK") return "OK";
    if (s === "ERRO") return "ERRO";
    if (s === "FERRAGENS-ONLY") return "FERRAGENS-ONLY";
    return s;
  };

  // CSV
  const csvLines = [];
  csvLines.push(['STATUS_INICIAL', 'STATUS_FINAL', 'ARQUIVO', 'ERROS_DETECTADOS', 'AVISOS', 'TAGS', 'ACOES_REALIZADAS (HISTORICO)', 'FINALIZADO_EM'].map(v => `"${v}"`).join(';'));

  for (const row of allFiles) {
    const errorsList = (row.initialErrors && row.initialErrors.length > 0) ? row.initialErrors : (row.errors || []);
    csvLines.push([
      formatStatus(row.initialStatus || row.status || ''),
      formatStatus(row.status || ''),
      row.filename || '',
      errorsList.join(' | '),
      (row.warnings || []).join(' | '),
      filterTags(row.tags || []).join(', '),
      (row.history || []).join(' | '),
      row.timestamp || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  }

  csvLines.push('');
  csvLines.push(['RESUMO DO RELATÓRIO DO DIA'].map(v => `"${v}"`).join(';'));
  csvLines.push(['Data da Última Exportação', now.toLocaleString('pt-BR')].map(v => `"${v}"`).join(';'));
  csvLines.push(['Total de Arquivos Processados', totalFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos OK (Corretos)', okFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos com Inconformidades (Erro)', errorFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos FERRAGENS-ONLY', ferragensFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos Muxarabi', muxarabiFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos Cor Coringa', coringaFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos Duplado 37MM', dupladoFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos Sem Código', semCodigoFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos Curvo', curvoFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Arquivos Corrigidos pelo Robô Auto-Fix', autoFixFiles].map(v => `"${v}"`).join(';'));
  csvLines.push(['Taxa de Sucesso', totalFiles > 0 ? `${(((okFiles + ferragensFiles) / totalFiles) * 100).toFixed(2)}%` : 'N/A'].map(v => `"${v}"`).join(';'));

  await fs.promises.writeFile(csvPath, '\ufeff' + csvLines.join('\n'), 'utf8');
  console.log('[Report] ✓ CSV atualizado com BOM UTF-8:', csvPath);

  return { ok: true, csvPath, filesCount: totalFiles };
}

/**
 * Remove todos os arquivos das pastas configuradas (OK, ERRO) respeitando dias de retenção.
 */
async function clearTargetFolders() {
  console.log('[Scheduler] ========== INICIANDO LIMPEZA DE PASTAS ==========');
  const cfg = state.currentCfg || (await loadCfg());

  const foldersToClear = [];
  if (cfg.cleanupCleanOk) foldersToClear.push(cfg.ok);
  if (cfg.cleanupCleanErro) foldersToClear.push(cfg.erro);
  const activeFolders = foldersToClear.filter(d => !!d);

  if (activeFolders.length === 0) {
    console.log('[Scheduler] Nenhuma pasta configurada para limpeza ativa.');
    return { ok: false, message: 'Nenhuma pasta ativa configurada para limpeza.' };
  }

  let clearedCount = 0;
  const retentionDays = cfg.cleanupRetentionDays !== undefined ? Number(cfg.cleanupRetentionDays) : 0;

  for (const dir of activeFolders) {
    try {
      if (await fse.pathExists(dir)) {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stats = await fs.promises.stat(fullPath);
          if (stats.isFile()) {
            let shouldDelete = true;
            if (retentionDays > 0) {
              const fileAgeMs = Date.now() - stats.mtime.getTime();
              const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
              shouldDelete = fileAgeMs > maxAgeMs;
            }
            if (shouldDelete) {
              await fse.remove(fullPath);
              clearedCount++;
            }
          }
        }
        console.log(`[Scheduler] ✓ Pasta limpa: ${dir}`);
      }
    } catch (e) {
      console.error(`[Scheduler] Erro ao limpar pasta ${dir}:`, e.message);
    }
  }
  return { ok: true, clearedCount };
}

let lastReportTimeStr = "";
let lastCleanupTimeStr = "";

/**
 * Loop que verifica o horário a cada minuto para gerar o relatório automático e limpar pastas.
 */
function startAutomaticScheduler() {
  console.log('[Scheduler] Iniciado. Verificação dinâmica configurada.');

  setInterval(async () => {
    try {
      const now = new Date();
      const day = now.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      const cfg = state.currentCfg || (await loadCfg());

      let isRightDay = false;
      const sDays = cfg.schedulerDays || "seg-sex";
      if (sDays === "seg-sex") {
        isRightDay = (day >= 1 && day <= 5);
      } else if (sDays === "seg-sab") {
        isRightDay = (day >= 1 && day <= 6);
      } else {
        isRightDay = true; // "todos"
      }

      if (!isRightDay) return;

      // 1. Relatório Automático
      if (cfg.schedulerEnabled) {
        const times = (cfg.schedulerTimes || "")
          .split(",")
          .map(t => t.trim())
          .filter(t => /^\d{2}:\d{2}$/.test(t));

        if (times.includes(currentTimeStr) && lastReportTimeStr !== currentTimeStr) {
          lastReportTimeStr = currentTimeStr;
          console.log(`[Scheduler] Horário de relatório atingido (${currentTimeStr}). Executando exportação automática...`);
          const reportData = await aggregateTodayLogs();
          if (reportData.rows.length > 0) {
            await saveDailyReport(reportData);
            console.log(`[Scheduler] Exportação automática concluída com sucesso.`);
          } else {
            console.log(`[Scheduler] Nenhum arquivo processado hoje para exportar.`);
          }
        }
      }

      // 2. Limpeza Automática
      if (cfg.cleanupEnabled) {
        const cleanTime = (cfg.cleanupTime || "17:30").trim();
        if (currentTimeStr === cleanTime && lastCleanupTimeStr !== currentTimeStr) {
          lastCleanupTimeStr = currentTimeStr;
          console.log(`[Scheduler] Horário de limpeza atingido (${currentTimeStr}). Executando limpeza automática...`);
          const res = await clearTargetFolders();
          console.log(`[Scheduler] Limpeza concluída:`, res);
        }
      }
    } catch (e) {
      console.error(`[Scheduler] Erro no ciclo do agendador automático:`, e.message);
    }
  }, 60000); // 60 segundos
}

/** ================== IPC: CLEAR TARGET FOLDERS ================== **/
ipcMain.handle('analyzer:clearTargetFolders', async () => {
  try {
    return await clearTargetFolders();
  } catch (e) {
    console.error('[Clear Folders] Erro:', e.message);
    return { ok: false, message: e.message };
  }
});

/** ================== IPC: EXPORT REPORT ================== **/
ipcMain.handle('analyzer:exportReport', async (_e, reportData) => {
  try {
    const res = await saveDailyReport(reportData);
    return {
      ...res,
      message: `Relatório diário atualizado (${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')})`
    };
  } catch (e) {
    console.log('[Export Report] ❌ ERRO NA EXPORTAÇÃO:', e.message || e);
    return { ok: false, message: `Erro ao exportar relatório: ${String(e.message || e)}` };
  }
});

// ========== ANALYZER: MOVE TO OK ==========
ipcMain.handle("analyzer:moveToOk", async (_, filePath) => {
  try {
    if (!filePath) return { ok: false, message: "Arquivo não informado" };
    const cfg = await loadCfg();
    if (!cfg.ok) return { ok: false, message: "Pasta Final OK não configurada" };

    const fileName = path.basename(filePath);
    const destPath = path.join(cfg.ok, fileName);

    // Garantir que a pasta de destino existe
    await fse.ensureDir(cfg.ok);

    // Mover arquivo (overwrite se existir)
    await fse.move(filePath, destPath, { overwrite: true });

    // ✅ GRAVAR LOG DE SUCESSO AO MOVER MANUALMENTE
    // Isso garante que o agendador automático veja este arquivo como OK
    if (cfg.logsProcessed) {
      await fse.ensureDir(cfg.logsProcessed);
      const logName = fileName.replace(/\.xml$/i, '') + '_ok.json';
      const logData = {
        arquivo: path.resolve(destPath),
        erros: [],
        warnings: [],
        tags: ["manually-moved"],
        autoFixes: [],
        timestamp: new Date().toLocaleString('pt-BR')
      };
      await fsp.writeFile(path.join(cfg.logsProcessed, logName), JSON.stringify(logData, null, 2), 'utf8');
    }

    console.log(`[Move] Arquivo movido para OK: ${destPath}`);
    return { ok: true, destPath };
  } catch (e) {
    console.error("[Move] Erro ao mover arquivo:", e);
    return { ok: false, message: String(e.message || e) };
  }
});

module.exports = { startAutomaticScheduler };
