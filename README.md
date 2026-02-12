# Bartz Analyzer - Sistema de Monitoramento XML

Aplicativo robusto desenvolvido em **Electron + Vite + React** para monitoramento em tempo real, validação automática e intervenção manual em arquivos XML de orçamentos.

O design foi projetado para ser intuitivo e eficiente, focado na produtividade do fluxo interno da Bartz.

---

## 🚀 Principais Funcionalidades

### 1. Monitoramento e Automação
- **Monitoramento em Tempo Real**: Observa pastas (inclusive caminhos UNC de rede) usando `chokidar` com suporte a polling.
- **Validação Automática de Regras**:
  - **REFERENCIA vazia**: Detecta itens sem código de referência.
  - **Quantidade Zero**: Corrige automaticamente de `0` para `1`.
  - **Preço Zero**: Ajusta automaticamente preços zerados para `0.10`.
- **Organização de Arquivos**: Move arquivos automaticamente para as pastas **OK** ou **ERRO** com base no resultado da validação, limpando duplicatas remanescentes.

### 2. Detecções Especializadas (Tags)
O sistema categoriza os arquivos automaticamente:
- **FERRAGENS**: Arquivos que contêm apenas itens de ferragens (`BUILDER="N"`).
- **MUXARABI**: Identifica referências `MX008001` ou `MX008002`.
- **COR CORINGA**: Detecta tokens de cores que precisam de substituição.
- **CURVO**: Identifica módulos curvos (`LR00xx`).
- **DUPLADO 37MM**: Alerta para itens com `ITEM_BASE="ES08"`.

### 3. Integração com ERP e Dados Externos
- **Busca de Produtos ERP**: Interface para consultar códigos, descrições e tipos de produtos diretamente no banco de dados do servidor.
- **Busca em CSV**: Consulta local de catálogos de CHAPAS, FITAS, PAINEL, PUXADORES e TAPAFURO através de arquivos CSV.
- **Comentários do Pedido**: Busca automática de observações e títulos de pedidos via API externa ao abrir um arquivo.

### 4. Gestão de Desenhos DXF
- **Busca Inteligente**: Localiza arquivos DXF correspondentes aos itens ES08 em pastas configuradas ou no fallback `Desktop/desenho_dxf`.
- **Análise de Arquivo DXF**: Lê o conteúdo técnico do DXF para identificar dimensões de `PANEL` e tokens de usinagem (`FRESA_12_37`, `USINAGEM_37`).
- **Correção 37mm → 18mm**: Ferramenta para converter automaticamente usinagens e dimensões de 37mm para 18mm no arquivo físico do DXF.

### 5. Intervenções Manuais (Drawer de Detalhes)
- **Substituição de Cor Coringa**: Troca individual de tokens ou substituição em lote de siglas (CG1/CG2).
- **Preenchimento de REFERENCIA**: Permite atribuir códigos a IDs específicos que estavam vazios.
- **Diálogos de Confirmação**: Todas as trocas manuais exigem confirmação visual e criam backups automáticos.
- **Sistema de Undo (Desfazer)**: Possibilidade de reverter a última alteração feita em um arquivo, restaurando o backup original.

### 6. Relatórios e Auditoria
- **Relatório Diário Agregado**: Exportação manual (via Dashboard) ou automática para **JSON** e **CSV** na pasta de exportação configurada.
- **Scheduler Automático (Interno)**: O sistema gera relatórios automaticamente às **11:30** e **17:30**, de segunda a sexta, enquanto o programa estiver aberto. Ele agrega todos os logs do dia.
- **Histórico de Ações**: O relatório registra o status inicial, status final e todas as ações de robô (auto-fix) ou manuais realizadas no arquivo.
- **Logs Detalhados**: Gravação de arquivos JSON das validações nas pastas de logs (base para o relatório automático).

---

## 🛠️ Tecnologias Utilizadas

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Manipulação de XML**: `fast-xml-parser`
- **Utilidades**: `fs-extra`, `chokidar`, `sonner` (toasts), `clsx`.

---

## ⚙️ Configuração

O aplicativo utiliza uma tela de configurações para definir o ambiente de trabalho:
- **Caminhos UNC**: Suporte total a caminhos de rede (ex: `\\servidor\pasta`).
- **Pasta de Entrada**: Local onde os arquivos XML originais são depositados.
- **Pastas Finais (OK/ERRO)**: Destino dos arquivos após o processamento.
- **Pasta de Desenhos**: Local oficial para busca de arquivos DXF.
- **Logs**: Pastas separadas para logs de processamento e erros.

---

## 💻 Instalação e Desenvolvimento

**Pré-requisitos**: Node.js instalado.

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

Isto inicia a build do frontend e a aplicação Electron em modo de desenvolvimento. Em dev o app tenta carregar `http://localhost:5174/`.

## Build/Distribuição

O projeto contém as configurações padrão para empacotamento com Electron + Vite — confira os scripts em `package.json` para comandos de build/electron-builder (se houver). Se preferir, rode os scripts que tiverem sido adicionados pelo mantenedor, por exemplo:

```powershell
npm run build
npm run dist
```

(Atenção: os nomes exatos dos scripts podem variar; verifique `package.json`.)

  ## Como usar — fluxo básico

1. Configure as pastas em *Caminhos de Rede* (Entrada, Pasta Final - OK, Pasta Final - Erro, Logs). Use o botão de pasta para ajudar.
2. Clique em *Iniciar* para começar a monitorar a pasta de entrada.
3. Quando o app detectar arquivos .xml, ele processa e exibe uma linha na tabela com status, erros, avisos e tags.

### Status do Arquivo

- **✅ OK** - Arquivo sem erros, movido automaticamente para a pasta OK
- **❌ ERRO** - Arquivo com erros detectados, movido automaticamente para a pasta ERRO
- **⚠️ AVISO** - Arquivo processado com avisos (pode ser OK ou ERRO conforme o tipo de aviso)

### Tags e Filtros

O sistema categoriza arquivos com as seguintes tags para fácil filtro:

- **FERRAGENS** — arquivo contém apenas máquinas de ferragens (BUILDER="N")
- **MUXARABI** — arquivo contém referência a MX008001 ou MX008002
- **COR CORINGA** — arquivo contém itens de cor coringa que precisam substituição
- **CURVO** — arquivo contém módulos curvos (LR00xx)
- **DUPLADO 37MM** — arquivo contém itens com ITEM_BASE="ES08"
- Auto-fixed — arquivo teve correções automáticas aplicadas

### Validação e Correção Automática

O sistema valida automaticamente:
- **REFERENCIA vazia** (REFERENCIA="") — detectada como erro
- **QUANTIDADE = 0** — corrigida automaticamente para 1
- **PRECO_TOTAL = 0** — corrigida automaticamente para 0.10
- **Máquina faltante** — detectada conforme configuração de tipo
- **Código de cor inválido** — detectado durante validação
- **Duplado 37MM** — detectado quando ITEM_BASE="ES08" está presente no arquivo

### Detecção de Duplado 37MM

- O validador procura automaticamente por itens com atributo `ITEM_BASE="ES08"`
- Quando encontrado, o arquivo recebe a tag `DUPLADO 37MM` e é classificado como erro
- Um card de KPI exibe a quantidade de arquivos com esta condição
- É possível filtrar arquivos por esta categoria na tabela principal
- O drawer de detalhes mostra claramente quais itens contêm o duplado 37MM

**Como verificar:**
- Abra o drawer de um arquivo com esta tag
- Na seção de "Erros", verá "ITEM DUPLADO 37MM"
- Os IDs dos itens afetados estão disponíveis nos metadados do arquivo

### Cor Coringa (detecção e ajuste manual)

- Quando o validador detectar tokens de "cor coringa" (ex.: `PAINEL_CG1_06`, etc.) o arquivo receberá a tag `COR CORINGA` e o drawer de detalhes mostrará um painel "Cor Coringa detectada".
- O select nessa área mostra somente as cores coringa que foram realmente encontradas no XML (a lista é extraída do próprio arquivo durante a validação).
- Para trocar:
  1. Selecione a cor coringa no select (apenas itens detectados aparecem).
  2. Informe o valor desejado em "Substituir por".
  3. Clique em "Trocar" — um **diálogo de confirmação** aparecerá mostrando a substituição que será feita
  4. Confirme a operação — o app faz um backup automático do arquivo, aplica a substituição no arquivo físico e reprocessa o arquivo.
  5. Depois da troca, clique em "Atualizar arquivo" se necessário para forçar reprocessamento; o painel será atualizado com os novos dados (o select deixará de listar as cores que já foram substituídas).

### Preenchimento de REFERENCIA por IDs

Nova funcionalidade para preencher automaticamente REFERENCIA vazia em itens específicos:

1. Abra o drawer de detalhes do arquivo
2. Navegue até a seção "Preencher REFERENCIA"
3. Para cada ID que deseja preencher:
   - Selecione o ID no dropdown (apenas IDs vazios aparecem)
   - Informe o valor de REFERENCIA a atribuir (ex.: "REF001")
   - Clique em "Preencher REFERENCIA"
4. Um **diálogo de confirmação** aparecerá mostrando:
   - O ID que será preenchido
   - O valor que será atribuído
   - Aviso de que um backup será criado
5. Confirme a operação
6. O sistema cria um backup automático, aplica as alterações e reprocessa o arquivo

**Importante**: Após preencher, o arquivo é reprocessado automaticamente. Se estava na pasta ERRO, será movido para OK se não houver mais erros.

### Desfazer (Undo)

- Após uma substituição bem-sucedida (Cor Coringa ou REFERENCIA) o app cria um backup em uma pasta de backups dentro do diretório de dados do usuário do app (valor retornado por `app.getPath('userData')`).
- É possível desfazer a última operação (por arquivo) clicando em "Desfazer última troca" no drawer — isso restaura o backup e reprocessa o arquivo.

### Diálogos de Confirmação

Para evitar erros por cliques acidentais, todas as operações críticas requerem confirmação:

- **Trocar Cor Coringa** — mostra claramente qual cor será substituída e por qual valor
- **Trocar CG1/CG2** — lista as substituições em lote que serão aplicadas
- **Preencher REFERENCIA** — confirma o ID e o valor que será preenchido

Cada diálogo de confirmação:
- Mostra os valores em **negrito e colorido** para fácil identificação
- Informa que um backup automático será criado
- Oferece botões "Cancelar" e "Confirmar"
- Impede execução acidental da operação

### Local dos backups e histórico

- **Backups**: `<userData>/backups/` — ex.: `%APPDATA%\<appname>\backups\` no Windows.
- **Histórico**: `<userData>/replace-history.json` — registra cada operação (timestamp, token trocado, backupPath, undo flag).

### Organização Automática de Arquivos

O sistema organiza automaticamente os arquivos:
- Arquivos **válidos** (sem erros) → pasta **OK**
- Arquivos **inválidos** (com erros) → pasta **ERRO**
- **Arquivos duplicados são automaticamente removidos** da pasta ERRO quando o arquivo é movido para OK

## Dicas e solução de problemas

- Se o select ainda mostrar a cor antiga depois de trocar, use o botão "Atualizar arquivo" no drawer — isso força reprocessamento e atualização dos dados exibidos.
- Se o arquivo tiver sido movido automaticamente para a pasta OK/Erro, o sistema de desfazer tenta casar o histórico por basename (nome do arquivo) como fallback.
- Logs de erro do processo de validação são gravados nas pastas configuradas em *Logs - Errors* e *Logs - Processed* (se configuradas).
- **Importante**: Quando você faz alterações (Cor Coringa ou Preencher REFERENCIA), sempre será criado um backup automático do arquivo original. Use "Desfazer última troca" para reverter.

## Contribuições

Sinta-se à vontade para abrir PRs. Mantenha as mudanças pequenas e compatíveis com o estilo do projeto.

## Licença

MIT

  