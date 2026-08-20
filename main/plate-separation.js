// main/plate-separation.js
// Gestão e leitura dos arquivos de controle de Separação de Chapas (.json e .pdf)
const { ipcMain, shell } = require("electron");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { PDFParse } = require("pdf-parse");

const DEFAULT_CONTROLE_DIR = "\\\\192.168.1.10\\DatabaseFolder\\PDF\\_controle";

/**
 * Faz o parser do texto extraído do PDF Promob de Separação de Chapas
 */
function parsePromobPdf(rawText) {
  if (!rawText) return { loteTitle: "", items: [] };
  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  let loteTitle = "";
  const items = [];
  const codeRegex = /\b(\d{2}\.\d{2}\.\d{3,4})\b/;

  for (const line of lines) {
    if (
      line.startsWith("PROMOB") ||
      line.startsWith("--") ||
      line.includes("SEPARAÇÃO") ||
      line.includes("Código") ||
      line.includes("Quantidade") ||
      line === "Lote:" ||
      line === "Resp:"
    ) {
      continue;
    }

    const loteMatch = line.match(/^(\d{3,6})\s+(.*)$/);
    if (loteMatch && !codeRegex.test(line)) {
      loteTitle = loteMatch[2].trim();
      continue;
    }

    const codeMatch = line.match(codeRegex);
    if (codeMatch) {
      const code = codeMatch[1];
      const parts = line.split(code);
      const desc = parts[0].trim().replace(/\t+/g, " ");
      const rest = (parts[1] || "").trim();
      const numMatches = rest.match(/(\d+(?:[.,]\d+)?)/g) || [];
      let qty = "";
      let metros = "";
      if (numMatches.length >= 2) {
        qty = numMatches[0];
        metros = numMatches[1];
      } else if (numMatches.length === 1) {
        qty = numMatches[0];
      }
      items.push({
        codigo: code,
        descricao: desc,
        quantidade: qty,
        metros: metros,
      });
    }
  }

  return { loteTitle, items };
}

/**
 * Lê todos os arquivos JSON da pasta de controle e mescla com os dados dos PDFs
 */
ipcMain.handle("analyzer:getPlateSeparationData", async (_e, customDir) => {
  const targetDir = customDir && typeof customDir === "string" ? customDir : DEFAULT_CONTROLE_DIR;

  try {
    const exists = await fsp.access(targetDir).then(() => true).catch(() => false);
    if (!exists) {
      return {
        ok: false,
        message: `Diretório não acessível: ${targetDir}`,
        folderPath: targetDir,
        data: [],
        count: 0,
      };
    }

    const files = await fsp.readdir(targetDir);
    const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
    const parentDir = path.dirname(targetDir);

    const items = await Promise.all(
      jsonFiles.map(async (fileName) => {
        const filePath = path.join(targetDir, fileName);
        const baseName = fileName.replace(/\.json$/i, "");
        const pdfPath = path.join(parentDir, `${baseName}.pdf`);
        const pdfUpperPath = path.join(parentDir, `${baseName}.PDF`);

        let pdfExists = false;
        let finalPdfPath = pdfPath;

        try {
          if (await fsp.access(pdfPath).then(() => true).catch(() => false)) {
            pdfExists = true;
            finalPdfPath = pdfPath;
          } else if (await fsp.access(pdfUpperPath).then(() => true).catch(() => false)) {
            pdfExists = true;
            finalPdfPath = pdfUpperPath;
          }
        } catch {
          pdfExists = false;
        }

        let content = null;
        let stats = null;

        try {
          stats = await fsp.stat(filePath);
        } catch {
          // stats error
        }

        try {
          const raw = await fsp.readFile(filePath, "utf8");
          content = JSON.parse(raw);
        } catch (parseErr) {
          content = { error: `Erro ao ler/interpretar JSON: ${parseErr.message}` };
        }

        // Tentar ler e fazer parse do PDF correspondente
        let pdfData = { loteTitle: "", items: [] };
        if (pdfExists) {
          try {
            const pdfBuf = await fsp.readFile(finalPdfPath);
            const pdfParser = new PDFParse({ data: pdfBuf });
            const textResult = await pdfParser.getText();
            pdfData = parsePromobPdf(textResult?.text || "");
          } catch (pdfErr) {
            console.error(`[PlateSeparation] Erro ao extrair texto do PDF ${finalPdfPath}:`, pdfErr);
          }
        }

        // Mesclar itens do PDF com itens do JSON de controle
        const jsonItens = content?.itens || {};
        const maxCount = Math.max(
          pdfData.items.length,
          Object.keys(jsonItens).length
        );

        const tableItems = [];
        for (let i = 0; i < maxCount; i++) {
          const pdfItem = pdfData.items[i] || {};
          const jsonItem = jsonItens[String(i)] || jsonItens[i] || {};

          tableItems.push({
            index: i,
            codigo: pdfItem.codigo || "",
            descricao: pdfItem.descricao || "",
            metros: pdfItem.metros || "",
            quantidade: pdfItem.quantidade || "",
            qtde_real: jsonItem.qtde_real !== undefined ? String(jsonItem.qtde_real) : "",
            obs: jsonItem.obs !== undefined ? String(jsonItem.obs) : "",
          });
        }

        return {
          id: baseName,
          fileName,
          filePath,
          pdfPath: finalPdfPath,
          pdfExists,
          size: stats ? stats.size : 0,
          mtime: stats ? stats.mtime.toISOString() : null,
          birthtime: stats ? stats.birthtime.toISOString() : null,
          responsavel: content?.responsavel || "",
          status: content?.status || "pendente",
          concluido_em: content?.concluido_em || "",
          concluido_por: content?.concluido_por || "",
          loteTitle: pdfData.loteTitle || "",
          tableItems,
          rawJson: content,
        };
      })
    );

    // Ordenar pelos mais recentes por padrão
    items.sort((a, b) => {
      const timeA = a.mtime ? new Date(a.mtime).getTime() : 0;
      const timeB = b.mtime ? new Date(b.mtime).getTime() : 0;
      return timeB - timeA;
    });

    return {
      ok: true,
      data: items,
      folderPath: targetDir,
      count: items.length,
    };
  } catch (err) {
    console.error("[PlateSeparation] Erro ao ler pasta de controle:", err);
    return {
      ok: false,
      message: err?.message || String(err),
      folderPath: targetDir,
      data: [],
      count: 0,
    };
  }
});

/**
 * Abrir arquivo específico (PDF ou JSON) no aplicativo padrão
 */
ipcMain.handle("analyzer:openPlateSeparationFile", async (_e, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    return { ok: false, message: "Caminho de arquivo inválido" };
  }

  try {
    const errorMsg = await shell.openPath(filePath);
    if (errorMsg) {
      return { ok: false, message: errorMsg };
    }
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
});

/**
 * Abrir pasta de controle ou pasta pai no Explorer
 */
ipcMain.handle("analyzer:openPlateSeparationFolder", async (_e, folderPath) => {
  const target = folderPath || DEFAULT_CONTROLE_DIR;
  try {
    const errorMsg = await shell.openPath(target);
    if (errorMsg) {
      return { ok: false, message: errorMsg };
    }
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
});
