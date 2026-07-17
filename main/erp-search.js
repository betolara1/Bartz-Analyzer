// main/erp-search.js
// Busca de produtos para os seletores da interface (chapas, fitas, cores coringa,
// tapa-furo, puxadores): CSV local de painéis, CSVs internos e as APIs do ERP.
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const { ipcMain } = require("electron");
const { send, removeAccents } = require("./helpers");

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

      // Sempre buscar todas as cores com proteção de tamanho para fazer filtragem local com suporte a acentos
      const url = `http://192.168.1.10:8081/api/cor?size=2000`;

      console.log(`[COR API] Solicitando todos os registros para filtragem local: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, {
          headers: { 'X-API-KEY': 'bartznewmoveisapi' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          let corResults = [];
          if (Array.isArray(data)) {
            corResults = data;
          } else if (data && Array.isArray(data.content)) {
            corResults = data.content;
          } else if (data) {
            corResults = [data];
          }

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
        url = `http://192.168.1.10:8081/api/item/search-code?q=${encodeURIComponent(codeTerm)}`;
      } else if (searchDesc) {
        // Enviar o termo mais longo para o banco para ser mais permissivo na query inicial
        // e depois filtramos rigorosamente localmente com todos os termos.
        const longestTerm = searchTerms.reduce((a, b) => a.length > b.length ? a : b, '');
        url = `http://192.168.1.10:8081/api/item/search-desc?q=${encodeURIComponent(longestTerm || searchDesc)}`;
      } else if (type && typePrefixes[type]) {
        // Se não informou código nem descrição, mas selecionou um tipo, busca pelo prefixo do tipo
        url = `http://192.168.1.10:8081/api/item/search-code?q=${encodeURIComponent(typePrefixes[type])}`;
      }

      if (url) {
        console.log(`[ERP API] Solicitando: ${url}`);

        // Adicionando timeout de 15 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await fetch(url, {
            headers: { 'X-API-KEY': 'bartznewmoveisapi' },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            let erpResults = Array.isArray(data) ? data : (data ? [data] : []);

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
