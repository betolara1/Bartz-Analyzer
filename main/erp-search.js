// main/erp-search.js
// Busca de produtos para os seletores da interface (chapas, fitas, cores coringa,
// tapa-furo, puxadores): CSV local de painéis, CSVs internos e as APIs do ERP.
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const { app, ipcMain, dialog, shell, Notification, nativeImage } = require("electron");
const { send, removeAccents, loadCfg } = require("./helpers");
const { ERP_BASE_URL, erpFetch, readErpJsonArray } = require("./erp-auth");
const mysql = require("mysql2/promise");
const state = require("./state");

ipcMain.handle('analyzer:searchErpProduct', async (_e, params) => {
  try {
    const { code, desc, type } = params || {};

    // Configurações de prefixo por tipo
    const typePrefixes = {
      'CHAPAS': '10.01.',
      'FITAS': '10.02.',
      'TAPAFURO': '10.15.',
      'CAPA': '10.03.'
    };

    // Prefixos permitidos para "TODOS"
    const allowedPrefixes = ['10.01.', '10.02.', '10.15.', '10.03.'];

    let allResults = [];

    // ==========================================================
    // 1. BUSCA EM CSV (Se type === 'PAINEL' ou 'TODOS')
    // ==========================================================
    if (type === 'PAINEL' || !type) {
      console.log('[Analyzer] Buscando no CSV de painéis (\\\\192.168.1.10\\Promob\\codigos_paineis.csv)...');
      const csvPath = '\\\\192.168.1.10\\Promob\\codigos_paineis.csv';

      if (await fse.pathExists(csvPath)) {
        const content = await fsp.readFile(csvPath, 'utf8');
        const lines = content.split(/\r?\n/).filter(x => x.trim());
        const header = lines[0] || '';
        const delimiter = header.includes(';') ? ';' : '\t';
        const searchCode = (code || '').trim().toUpperCase();
        const searchDesc = (desc || '').trim().toUpperCase();
        const searchTerms = searchDesc.split(/\s+/).filter(t => t.length > 0);

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter);
          if (cols.length < 2) continue;
          const rowCode = (cols[0] || '').trim().toUpperCase();
          const rawDesc = (cols[1] || '').trim().toUpperCase();
          const rowThickness = (cols[2] || '').trim().toUpperCase();

          let match = false;
          if (searchCode) {
            if (rowCode === searchCode || rowCode.startsWith(searchCode)) match = true;
          } else if (searchTerms.length > 0) {
            match = searchTerms.every(term => {
              const cleanTerm = term.replace(/MM$/i, '');
              const cleanTermNoAccent = removeAccents(cleanTerm);
              const termNoAccent = removeAccents(term);
              const rawDescNoAccent = removeAccents(rawDesc);
              const inDesc = rawDescNoAccent.includes(termNoAccent) || rawDescNoAccent.includes(cleanTermNoAccent);
              const inThickness = rowThickness && (rowThickness === term || rowThickness === cleanTerm);
              return inDesc || inThickness;
            });
          } else {
            match = true;
          }

          if (match) {
            allResults.push({
              code: (cols[0] || '').trim(),
              description: rawDesc,
              thickness: (cols[2] || '').trim()
            });
          }
        }
      }
    }

    // ==========================================================
    // 1.1 BUSCA EM API DE CORES (Se type === 'CORINGA')
    // ==========================================================
    if (type === 'CORINGA') {
      const searchDesc = (desc || '').trim().toUpperCase();
      const codeTerm = (code || '').trim().toUpperCase();

      // Sempre buscar todas as cores para fazer filtragem local com suporte a acentos
      const url = `${ERP_BASE_URL}/cores`;

      console.log(`[COR API] Solicitando todos os registros para filtragem local: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await erpFetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        {
          const corResults = await readErpJsonArray(response);

          console.log(`[COR API] Resultados recebidos: ${corResults.length}`);

          corResults.forEach(item => {
            const rowCode = (item.siglaCor || item.sigla || item.code || item.CODIGO || item.refComercial || item.id || '').toString().trim();
            const rawDesc = (item.descricao || item.description || item.DESCRICAO || item.nome || '').toString().trim();

            if (!rowCode) return;

            // Limpeza de descrição para o select
            const rowDescFormatted = rawDesc.split('-')[0]
              .replace(/\b(MDF|MDP|1F|2F|BP|\d{1,2}MM)\b/gi, '')
              .replace(/\s+/g, ' ')
              .trim();

            allResults.push({
              code: rowCode,
              description: rowDescFormatted || rowCode
            });
          });

          // Filtragem local inteligente com suporte a acentos
          if (searchDesc || codeTerm) {
            const queryClean = removeAccents(searchDesc || codeTerm).toUpperCase();
            allResults = allResults.filter(res => {
              const codeClean = removeAccents(res.code).toUpperCase();
              const descClean = removeAccents(res.description).toUpperCase();
              return codeClean.includes(queryClean) || descClean.includes(queryClean);
            });
          }

          // Remover duplicatas baseadas na descrição formatada
          const uniqueMap = new Map();
          for (const res of allResults) {
            if (!uniqueMap.has(res.description)) {
              uniqueMap.set(res.description, res);
            }
          }
          allResults = Array.from(uniqueMap.values());
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error(`[COR API] Erro na requisição ${url}:`, err.message);
      }
    }

    // ==========================================================
    // 2. BUSCA NO ERP (Sempre executa para buscar itens relacionados no banco, EXCETO para CORINGA e PAINEL)
    // ==========================================================
    if (type !== 'CORINGA' && type !== 'PAINEL') {
      let url = '';
      const searchDesc = (desc || '').trim().toUpperCase();
      const codeTerm = (code || '').trim().toUpperCase();
      const searchTerms = searchDesc.split(/\s+/).filter(t => t.length > 0);

      if (codeTerm) {
        url = `${ERP_BASE_URL}/itens/search?codigo=${encodeURIComponent(codeTerm)}`;
      } else if (searchDesc) {
        // Enviar o termo mais longo para o banco para ser mais permissivo na query inicial
        // e depois filtramos rigorosamente localmente com todos os termos.
        const longestTerm = searchTerms.reduce((a, b) => a.length > b.length ? a : b, '');
        url = `${ERP_BASE_URL}/itens/search?descricao=${encodeURIComponent(longestTerm || searchDesc)}`;
      } else if (type && typePrefixes[type]) {
        // Se não informou código nem descrição, mas selecionou um tipo, busca pelo prefixo do tipo
        url = `${ERP_BASE_URL}/itens/search?codigo=${encodeURIComponent(typePrefixes[type])}`;
      }

      if (url) {
        console.log(`[ERP API] Solicitando: ${url}`);

        // Adicionando timeout de 15 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await erpFetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          {
            let erpResults = await readErpJsonArray(response);

            // Filtragem local inteligente com suporte a acentos
            erpResults = erpResults.filter(item => {
              const itemCode = (item.code || item.CODIGO || item.item_code || item.codeItem || item.refComercial || '').toString().toUpperCase();
              const itemDesc = (item.description || item.DESCRICAO || item.item_description || item.descItem || item.nomeItem || item.descricao || '').toString().toUpperCase();

              // 1. Filtrar por formato rigoroso: apenas xx.xx.xxxx (exatamente 2 pontos)
              const dotCount = (itemCode.match(/\./g) || []).length;
              if (dotCount !== 2) return false;

              // 2. Se um tipo específico foi selecionado (exceto PAINEL que busca em tudo do banco)
              if (type && type !== 'PAINEL' && typePrefixes[type]) {
                if (!itemCode.startsWith(typePrefixes[type])) return false;
              } else {
                // Se "TODOS" ou "PAINEL", aceita qualquer um dos prefixos permitidos
                if (!allowedPrefixes.some(p => itemCode.startsWith(p))) return false;
              }

              // 3. Match de todos os termos da busca
              if (searchTerms.length > 0) {
                const normDesc = removeAccents(itemDesc);
                const normCode = removeAccents(itemCode);
                return searchTerms.every(term => {
                  const normTerm = removeAccents(term);
                  const cleanNormTerm = normTerm.replace(/MM$/i, '');
                  return normDesc.includes(normTerm) || normDesc.includes(cleanNormTerm) || normCode.includes(normTerm);
                });
              }

              return true;
            });

            // Adicionar ao pool global
            erpResults.forEach(item => {
              allResults.push({
                code: (item.code || item.CODIGO || item.item_code || item.codeItem || item.refComercial || '').toString(),
                description: (item.description || item.DESCRICAO || item.item_description || item.descItem || item.nomeItem || item.descricao || '').toString()
              });
            });
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`[ERP API] Erro na requisição ${url}:`, fetchError.name === 'AbortError' ? 'Timeout' : fetchError.message);
        }
      }
    }

    // Remover duplicatas caso o código apareça em ambos (raro, mas possível)
    const uniqueMap = new Map();
    allResults.forEach(r => uniqueMap.set(r.code, r));
    const finalResults = Array.from(uniqueMap.values());

    return { ok: true, results: finalResults, count: finalResults.length };
  } catch (e) {
    console.error(`[ERP API Error] ${e.message}`);
    return { ok: false, message: `Erro na busca: ${e.message}`, results: [] };
  }
});

ipcMain.handle('analyzer:getOrderComments', async (_e, numPedido) => {
  try {
    if (!numPedido) return { ok: false, message: 'Número do pedido não informado.' };

    const url = `http://192.168.1.10:8080/api_pedidos.php?num_pedido=${encodeURIComponent(numPedido)}`;
    console.log(`[Order API] Solicitando: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    // A API retorna um array de comentários
    return { ok: true, data: Array.isArray(data) ? data : (data ? [data] : []) };
  } catch (e) {
    console.error(`[Order API Error] ${e.message}`);
    return { ok: false, message: `Erro ao buscar pedido: ${e.message}` };
  }
});

ipcMain.handle('analyzer:getSpecialOrders', async () => {
  let connection;
  try {
    const cfg = state.currentCfg || (await loadCfg());
    const dbHost = (cfg.dbHost || "mysql55-farm2.uni5.net").trim();
    const dbPort = Number(cfg.dbPort) || 3306;
    const dbUser = (cfg.dbUser || "bartzpedidosph").trim();
    const dbPassword = cfg.dbPassword !== undefined && cfg.dbPassword !== "" ? cfg.dbPassword : "mangaROSA2006";
    const dbName = (cfg.dbName || "bartzpedidosph").trim();

    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectTimeout: 8000,
    });

    const [orders] = await connection.execute(`
      SELECT 
        e.pk_pedido_engenharia, 
        e.pk_pedido, 
        p.num_pedido, 
        e.txt_status AS status_engenharia, 
        e.bit_lido,
        DATE_FORMAT(COALESCE(e.dat_data_modificacao, e.dat_data), '%d/%m/%Y %H:%i') AS dat_envio, 
        s.txt_descricao AS situacao_pedido,
        u.txt_nome AS nome_usuario
      FROM tab_pedido_engenharia e
      LEFT JOIN tab_pedido p ON e.pk_pedido = p.pk_pedido
      LEFT JOIN tab_situacao s ON p.pk_situacao = s.pk_situacao
      LEFT JOIN tab_usuario u ON e.pk_usuario = u.pk_usuario
      ORDER BY e.pk_pedido_engenharia DESC
    `);

    if (!Array.isArray(orders) || orders.length === 0) {
      await connection.end();
      return { ok: true, data: [] };
    }

    const pedidoIds = orders.map(o => o.pk_pedido).filter(Boolean);

    let commentsByPedido = {};
    if (pedidoIds.length > 0) {
      const placeholders = pedidoIds.map(() => '?').join(',');
      const [comments] = await connection.execute(`
        SELECT 
          c.pk_pedido_comentario, 
          c.pk_pedido, 
          c.txt_titulo, 
          c.txt_comentario,
          c.int_situacao,
          DATE_FORMAT(c.dat_data, '%d/%m/%Y %H:%i') AS dat_data,
          u.txt_nome AS nome_usuario,
          o.txt_arquivo
        FROM tab_pedido_comentario c
        LEFT JOIN tab_usuario u ON c.pk_usuario = u.pk_usuario
        LEFT JOIN tab_pedido_xml_outros o ON c.pk_pedido_comentario = o.pk_pedido_comentario
        WHERE c.pk_pedido IN (${placeholders})
        ORDER BY c.dat_data DESC, c.pk_pedido_comentario DESC
      `, pedidoIds);

      if (Array.isArray(comments)) {
        comments.forEach(c => {
          if (!commentsByPedido[c.pk_pedido]) {
            commentsByPedido[c.pk_pedido] = [];
          }
          commentsByPedido[c.pk_pedido].push(c);
        });
      }
    }

    await connection.end();

    const result = orders.map(order => ({
      ...order,
      comentarios: commentsByPedido[order.pk_pedido] || []
    }));

    return { ok: true, data: result };
  } catch (e) {
    if (connection) await connection.end().catch(() => {});
    console.error(`[Special Orders API Error] ${e.message}`);
    return { ok: false, message: `Erro ao buscar pedidos especiais: ${e.message}`, data: [] };
  }
});

ipcMain.handle('analyzer:downloadCommentFile', async (_e, { filename }) => {
  try {
    if (!filename) return { ok: false, message: 'Nome do arquivo não informado.' };

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Salvar anexo do comentário',
      defaultPath: filename,
    });

    if (canceled || !filePath) {
      return { ok: false, message: 'Download cancelado pelo usuário.' };
    }

    // 1. Tentar cópia de arquivo local / rede primeiramente
    const localPaths = [
      path.join('C:', 'xampp', 'htdocs', 'pedidos', 'arquivos', 'outros', filename),
      `\\\\192.168.1.10\\pedidos\\arquivos\\outros\\${filename}`,
      `\\\\192.168.1.10\\c$\\xampp\\htdocs\\pedidos\\arquivos\\outros\\${filename}`,
    ];

    for (const localP of localPaths) {
      try {
        if (await fse.pathExists(localP)) {
          console.log(`[Download Comment File] Encontrado localmente em: ${localP}`);
          await fse.copy(localP, filePath);
          return { ok: true, destPath: filePath };
        }
      } catch (errLocal) {
        // ignora erro e tenta proxima fonte
      }
    }

    // 2. Tentar via HTTP em várias rotas possíveis (com /pedidos e sem /pedidos, portas 8080 e 80)
    const cfg = state.currentCfg || (await loadCfg());
    const dbHost = (cfg.dbHost || "192.168.1.10").trim();
    const cleanHost = dbHost.includes("uni5.net") ? "192.168.1.10" : dbHost;

    const urlsToTry = [
      `https://pedidosbartzmoveis.com.br/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://pedidosbartzmoveis.com.br/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://${cleanHost}:8080/pedidos/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://${cleanHost}/pedidos/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://${cleanHost}:8080/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://${cleanHost}/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://192.168.1.10:8080/pedidos/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://192.168.1.10/pedidos/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://192.168.1.10:8080/arquivos/outros/${encodeURIComponent(filename)}`,
      `http://192.168.1.10/arquivos/outros/${encodeURIComponent(filename)}`,
    ];

    let downloadedBuffer = null;
    let lastError = null;

    for (const fileUrl of urlsToTry) {
      try {
        console.log(`[Download Comment File] Solicitando: ${fileUrl}`);
        const response = await fetch(fileUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          downloadedBuffer = Buffer.from(arrayBuffer);
          break;
        } else {
          lastError = `HTTP ${response.status}`;
        }
      } catch (fetchErr) {
        lastError = fetchErr.message;
      }
    }

    if (downloadedBuffer) {
      await fsp.writeFile(filePath, downloadedBuffer);
      return { ok: true, destPath: filePath };
    }

    return { ok: false, message: `Erro ao baixar arquivo do servidor (${lastError || 'HTTP 404'}).` };
  } catch (err) {
    console.error("[Download Comment File Error]", err.message);
    return { ok: false, message: `Erro ao baixar arquivo: ${err.message}` };
  }
});

ipcMain.handle('analyzer:openFile', async (_e, filePath) => {
  try {
    if (filePath && await fse.pathExists(filePath)) {
      await shell.openPath(filePath);
      return { ok: true };
    }
    return { ok: false, message: 'Arquivo não encontrado.' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle('analyzer:completeEngineeringOrder', async (_e, { pk_pedido_engenharia, pk_usuario_alteracao }) => {
  let connection;
  try {
    if (!pk_pedido_engenharia) {
      return { ok: false, message: 'ID da engenharia do pedido não informado.' };
    }

    let userId = pk_usuario_alteracao;
    if (!userId) {
      try {
        if (await fse.pathExists(state.USER_SESSION_FILE)) {
          const session = await fse.readJson(state.USER_SESSION_FILE);
          userId = session?.pk_usuario || null;
        }
      } catch (e) {}
    }

    const cfg = state.currentCfg || (await loadCfg());
    const dbHost = (cfg.dbHost || "mysql55-farm2.uni5.net").trim();
    const dbPort = Number(cfg.dbPort) || 3306;
    const dbUser = (cfg.dbUser || "bartzpedidosph").trim();
    const dbPassword = cfg.dbPassword !== undefined && cfg.dbPassword !== "" ? cfg.dbPassword : "mangaROSA2006";
    const dbName = (cfg.dbName || "bartzpedidosph").trim();

    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectTimeout: 8000,
    });

    await connection.execute(
      `UPDATE tab_pedido_engenharia 
       SET txt_status = 'Concluido', 
           pk_usuario_alteracao = ?, 
           dat_data_modificacao = NOW() 
       WHERE pk_pedido_engenharia = ?`,
      [userId || null, pk_pedido_engenharia]
    );

    await connection.end();

    return { ok: true, message: 'Pedido marcado como Concluído com sucesso!' };
  } catch (err) {
    if (connection) await connection.end().catch(() => {});
    console.error("[Complete Engineering Order Error]", err.message);
    return { ok: false, message: `Erro ao atualizar status: ${err.message}` };
  }
});

function createBadgeOverlay(rawArg) {
  let count = 0;
  let dataUrl = null;

  if (typeof rawArg === "number") {
    count = rawArg;
  } else if (rawArg && typeof rawArg === "object") {
    count = rawArg.count || 0;
    dataUrl = rawArg.dataUrl || null;
  } else if (typeof rawArg === "string") {
    count = parseInt(rawArg, 10) || 0;
  }

  if (!count || count <= 0) return null;

  if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:image")) {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (img && !img.isEmpty()) return img;
    } catch (e) {}
  }

  // Fallback 32x32 RGBA Bitmap Buffer
  const width = 32;
  const height = 32;
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - 16;
      const dy = y - 16;
      const distSq = dx * dx + dy * dy;
      const idx = (y * width + x) * 4;

      if (distSq <= 14 * 14) {
        if (distSq >= 12 * 12) {
          // White border
          buffer[idx] = 255;
          buffer[idx + 1] = 255;
          buffer[idx + 2] = 255;
          buffer[idx + 3] = 255;
        } else {
          // Purple fill (#9333ea)
          buffer[idx] = 234;
          buffer[idx + 1] = 51;
          buffer[idx + 2] = 147;
          buffer[idx + 3] = 255;
        }
      }
    }
  }

  return nativeImage.createFromBitmap(buffer, { width, height });
}

ipcMain.handle("analyzer:sendNotification", async (_e, { title, body, count }) => {
  try {
    if (Notification.isSupported()) {
      const notif = new Notification({
        title: title || "Bartz Analisador",
        body: body || "",
      });
      notif.on("click", () => {
        if (state.win) {
          if (state.win.isMinimized()) state.win.restore();
          state.win.focus();
        }
      });
      notif.show();
    }

    if (state.win && !state.win.isFocused()) {
      state.win.flashFrame(true);
    }

    if (state.win) {
      const img = createBadgeOverlay(count);
      if (img && !img.isEmpty()) {
        state.win.setOverlayIcon(img, count > 0 ? `${count} pedidos pendentes` : "");
      } else {
        state.win.setOverlayIcon(null, "");
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[Notification Error]", err.message);
    return { ok: false, message: err.message };
  }
});

ipcMain.handle("analyzer:setTaskbarBadge", async (_e, rawArg) => {
  try {
    let count = 0;
    if (typeof rawArg === "number") {
      count = rawArg;
    } else if (rawArg && typeof rawArg.count === "number") {
      count = rawArg.count;
    } else if (typeof rawArg === "string") {
      count = parseInt(rawArg, 10) || 0;
    }

    if (app && typeof app.setBadgeCount === "function") {
      try {
        app.setBadgeCount(count);
      } catch (e) {}
    }

    if (state.win) {
      if (count > 0) {
        const img = createBadgeOverlay(rawArg);
        if (img && !img.isEmpty()) {
          state.win.setOverlayIcon(img, `${count} pedidos especiais pendentes`);
        } else {
          state.win.setOverlayIcon(null, "");
        }
      } else {
        state.win.setOverlayIcon(null, "");
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[setTaskbarBadge Error]", err.message);
    return { ok: false, message: err.message };
  }
});

ipcMain.handle('analyzer:searchCsvProduct', async (_e, obj) => {
  try {
    const { colorName, productType } = obj || {};

    if (!colorName || !productType) {
      return { ok: false, message: 'invalid-params', results: [] };
    }

    // Validar tipo de produto
    const validTypes = ['CHAPAS', 'FITAS', 'PAINEL', 'PUXADORES', 'TAPAFURO'];
    if (!validTypes.includes(productType.toUpperCase())) {
      return { ok: false, message: 'invalid-product-type', results: [] };
    }

    // Construir caminho do arquivo CSV
    const csvFileName = `${productType.toUpperCase()}.csv`;
    const csvPath = path.join(__dirname, '..', 'csv', csvFileName);

    // Verificar se arquivo existe
    const exists = await fse.pathExists(csvPath);
    if (!exists) {
      send('error', { where: 'searchCsvProduct', message: `Arquivo CSV não encontrado: ${csvFileName}` });
      return { ok: false, message: 'csv-not-found', results: [] };
    }

    // Ler arquivo CSV
    const csvContent = await fsp.readFile(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      return { ok: false, message: 'empty-csv', results: [] };
    }

    // Primeira linha é o cabeçalho, usar para detectar delimitador
    const header = lines[0];
    const dataLines = lines.slice(1);

    // Auto-detectar delimitador: TAB ou ponto e vírgula
    // PAINEL usa ";" enquanto outros usam "\t"
    const delimiter = header.includes(';') ? ';' : '\t';

    // Buscar linhas que contenham o nome da cor (case-insensitive)
    const searchTerm = removeAccents(colorName.toLowerCase());
    const results = [];

    for (const line of dataLines) {
      // CSV separado por delimitador detectado
      const columns = line.split(delimiter);
      if (columns.length < 2) continue;

      const code = (columns[0] || '').trim();
      const description = (columns[1] || '').trim();
      const group = columns.length > 2 ? (columns[2] || '').trim() : '';

      // Verificar se a descrição contém o nome da cor
      if (removeAccents(description.toLowerCase()).includes(searchTerm)) {
        results.push({
          code,
          description,
          group
        });
      }
    }

    return { ok: true, results, count: results.length };
  } catch (e) {
    send('error', { where: 'searchCsvProduct', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e), results: [] };
  }
});
