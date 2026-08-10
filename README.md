<div align="center">

# 🏗️ Bartz Analyzer

### Sistema Industrial de Monitoramento, Validação de Engenharia, Integração ERP DB2/MySQL e Auto-Fix de XML/DXF para Produção CNC

[![Versão](https://img.shields.io/badge/Versão-6.0.0-8B5CF6?style=for-the-badge&logo=electron&logoColor=white)](https://github.com/betolara1/Bartz-Analyzer)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-37.3-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![IBM DB2](https://img.shields.io/badge/IBM_DB2-bartznew-0540F5?style=for-the-badge&logo=ibm&logoColor=white)](https://www.ibm.com/products/db2)
[![MySQL2](https://img.shields.io/badge/MySQL-Auth_&_Sessão-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-3.2-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

*Uma solução robusta de engenharia de software aplicada ao chão de fábrica, desenvolvida para eliminar gargalos de produção, impedir perda de matéria-prima, consultar o ERP em tempo real e automatizar a correção de arquivos de usinagem CNC.*

</div>

---

## 📸 Preview da Interface

<div align="center">
  <img src="assets/foto1.png" width="49%" alt="Dashboard Principal & Métricas em Tempo Real" />
  <img src="assets/foto2.png" width="49%" alt="Drawer de Detalhes & Validação de Engenharia" />
  <img src="assets/foto3.png" width="49%" alt="Gerenciamento de Cores Coringa & Substituição de Siglas" />
  <img src="assets/foto4.png" width="49%" alt="Configurações de Rede, Scheduler & Auto-Fix" />
</div>

---

## 📌 Resumo Executivo & Contexto de Negócio

No ecossistema fabril da **Bartz Móveis Planejados**, os projetos elaborados pelos projetistas no software **Promob** são exportados em formato **XML** e direcionados diretamente para o maquinário CNC de alta precisão (como furadeiras e seccionadoras **ASPAN** e **NCB612**).

Inconsistências em arquivos exportados (como furações dupladas de 31mm/37mm descalibradas, ausência de código de peças, cores coringa não substituídas, ausência de parâmetros de máquinas ou falhas na estrutura de sub-itens) historicamente geravam **interrupções na linha de produção**, **quebra de ferramentas de usinagem** e **desperdício de chapas de MDF/MDP**.

O **Bartz Analyzer** é uma aplicação **Desktop Cross-Platform de Missão Crítica (v6.0.0)** que atua como uma sentinela autônoma de monitoramento de rede. Ele inspeciona, valida contra APIs e banco de dados corporativo **IBM DB2 (`bartznew`)** e **MySQL**, gerencia pedidos especiais da engenharia, gera relatórios analíticos e **executa correções automáticas (Auto-Fix) diretamente na estrutura de tags do XML e em arquivos vetoriais CAD (.DXF)** antes que os arquivos cheguem ao chão de fábrica.

---

## ⚙️ Arquitetura de Software & Design Patterns

A aplicação foi projetada seguindo padrões modernos de arquitetura de software Desktop, garantindo **segurança de processos, alta disponibilidade, resiliência a falhas e desacoplamento de responsabilidades**.

```mermaid
graph TD
    subgraph Monitoramento ["🛰️ Camada de Entrada & Watcher"]
        A["Diretório de Entrada / Redes UNC"] -->|Debounced File Event| B["Chokidar File Watcher"]
    end

    subgraph CoreEngine ["🔬 Motor de Processamento (Main Process)"]
        B --> C["XML Parser & Inspector - xml-logic.js"]
        C --> D{"Validações de Engenharia"}
        
        D -->|1. Validação de Preços & Qtd| E["Auto-Fix XML Attributes"]
        D -->|2. Checagem ERP / DB2| F["HTTP API & Direct DB2 Connector - db2-search.js"]
        D -->|3. Fresa 31mm/37mm / ES08| G["DXF Vector Rewriter - dxf-tools.js"]
        D -->|4. Injeção de Muxarabi / MX008| H["DXF Grid Template Injector"]
        D -->|5. Checagem de Máquinas| I["Filtro de Plugins ASPAN / NCB612"]
        
        E --> J{"Decisão do Pipeline"}
        F --> J
        G --> J
        H --> J
        I --> J
    end

    subgraph OutputRouting ["📁 Roteamento de Arquivos & Desenhos"]
        J -->|Sem Erros Graves| K["Mover para Pasta OK"]
        J -->|Erros Impeditivos| L["Mover para Pasta ERRO"]
        J -->|Geração de Cópia| M["XML Simplificado / Resumido"]
        G --> N["Atualizar Pasta Espelho DXF (Mirror)"]
        G --> NC["Enviar Cópia para Pasta de Cópia"]
        H --> N
    end

    subgraph UserInterface ["🎨 Processo de Renderização (React 18 UI)"]
        K --> O["Dashboard React em Tempo Real"]
        L --> O
        O --> P["Fila de Atividade, KPIs & Logs"]
        O --> Q["Drawer de Edição Interativa & Backup/Undo"]
        O --> SPE["Central de Pedidos Especiais"]
        O --> BATCH["Modal de Lote DXF & XML"]
    end

    subgraph Automation ["⏰ Tarefas Agendadas & ERP Sync"]
        R["Scheduler Interno"] -->|11:30 & 17:30| S["Exportação Diária CSV - UTF-8 BOM"]
        R -->|17:30| T["Faxina Automática de Pastas Temporárias"]
        U["Buscador DXF Otimizado"] -->|3 Tiers de Resposta| V["Histórico -> DB2 ERP -> Varredura Concorrente (24x)"]
    end
```

### 🏢 Modelo Multi-Processo (Electron IPC Architecture)

* **Processo Principal (Main Process - Node.js):** Executa o daemon de monitoramento (`chokidar`), manipulação de arquivos no SO, parsing AST de XMLs com `fast-xml-parser`, reescrita binária/vetorial de arquivos CAD DXF, conector direto ODBC com **IBM DB2** (`ibm_db`), autenticação segura com **MySQL** (`mysql2`), rotinas de backup, agendamento de relatórios e requisições HTTP para as APIs do ERP.
* **Processo de Renderização (Renderer Process - React 18 + Vite):** Interface SPA reativa construída com TypeScript e Tailwind CSS. Exibe o estado em tempo real da fila de produção, dashboards de métricas (KPIs), busca avançada, central de pedidos especiais, gerenciador de desenhos com vinculação de pedidos e drawer de inspeção detalhada.
* **Preload Bridge (`preload.js`):** Camada de isolamento de contexto (`contextBridge`) que expõe uma API fortemente tipada (`window.electron.analyzer`, `window.electron.settings`, `window.electron.updater`, `window.electron.auth`) via IPC, garantindo que a UI não possua acesso direto ao Node.js nativo (cumprindo os mais rígidos padrões de segurança do Electron).

---

## ⚡ Funcionalidades Principais em Detalhes

### 1. ⚡ Buscador Inteligente de Desenhos DXF & Identificação de Pedido (Otimização 15s → 3s)
* **Associação Automática de Pedido:** Ao pesquisar por qualquer código de desenho (ex: `ESP00004780A`), o sistema identifica automaticamente a qual número de pedido o desenho pertence (ex: `ESP00004780A — Pedido 69012`).
* **Arquitetura de Busca em 3 Tiers de Resposta:**
  1. **Tier 1 (Instantâneo):** Cruza com o histórico local de análises processadas (`analysis-history.json`).
  2. **Tier 2 (ERP DB2 ~2s):** Executa consulta SQL otimizada diretamente na base IBM DB2 (`bartznew`) casando o código de desenho (`ITEM.NARRATIVA_1`).
  3. **Tier 3 (Pasta de Busca):** Varre os arquivos XML em lote usando **leitura concorrente paralela com 24 trabalhadores**, reduzindo o tempo de escaneamento de rede de 15 segundos para apenas 3 segundos.
* **Indicadores Visuais de Origem:** A UI informa ao operador a origem exata da vinculação (`histórico`, `ERP DB2` ou `pasta de busca`).

---

### 2. 🌟 Central de Pedidos Especiais da Engenharia & Download Promob
* **Notificações em Tempo Real na Barra de Tarefas:** Contador badge integrado ao ícone da aplicação no Windows, exibindo a quantidade de pedidos especiais pendentes de análise.
* **Aba de Gestão & Comentários:** Modal e drawer dedicados para visualização de pedidos especiais com dropdown interativo para atualização e histórico de comentários.
* **Download Ágil do Pedido:** Botão dedicado para baixar o pedido completo diretamente pela interface.
* **Download de `.promob` de Fallback:** Capacidade de download direto do arquivo `.promob` original do projeto via API caso o `ImportKey` esteja indisponível.

---

### 3. 🔐 Autenticação Corporativa & Controle de Acesso Granular por Permissão
* **Sistema de Permissões Centralizado:** Integração com autenticação MySQL com o mesmo login do sistema *Pedidos Online*:
  * **Permissão 37 (Admin Analisador):** Libera os botões de ação restrita no Drawer (*Pasta Espelho*, *Enviar para*, *Corrigir Fresa*, *Trocar Descrição*, *Auto-Fix Geral* e conexão de banco de dados).
  * **Permissão 36 (Pedidos Especiais / Engenharia):** Habilita o acesso e notificações automáticas de Pedidos Especiais da Engenharia.
* **Resiliência e Proteção Dinâmica:** Todas as seções e tabelas do Drawer validam as permissões do usuário em tempo de execução.

---

### 4. 🔬 Motor de Validação de Engenharia de Produção

O sistema realiza inspeções profundas na estrutura XML de cada pedido de produção:

| Validação | Código / Tag | Ação do Sistema | Impacto Evitado |
| :--- | :--- | :--- | :--- |
| **Itens sem Código** | `REFERENCIA=""` / `ITEM_BASE=""` | Flag de Erro Impeditivo (`SEM CÓDIGO`) + Destaque no Drawer | Paralisação da CNC por falta de especificação de usinagem. |
| **Itens Sem Preço/Qtd** | `PRECO_TOTAL="0"` / `QUANTIDADE="0"` | Flag de Alerta / Correção via Auto-Fix | Inconsistência no faturamento e falha no envio de insumos. |
| **Item Duplado 31mm / 37mm** | `ITEM_BASE="ES08"` | Alerta `DUPLADO` + Auto-Fix de fresa para 18mm no DXF | Quebra de fresa em usinagens dupladas com diâmetro descalibrado. |
| **Cores Coringa** | `PAINEL_CG1_18`, `FITA_CG2_22`, etc. | Alerta `COR CORINGA` + Tela de substituição em lote com Undo | Produção de móveis com chapas em cores genéricas incorretas. |
| **Peça Muxarabi** | `ITEM_BASE="MX008..."` | Alerta `MUXARABI` + Injeção automática de malha 2D no DXF | Peças vazadas sem o desenho de usinagem em grade. |
| **Sem Item Filho** | Top-level `<ITEM>` sem sub-tags | Alerta `SEM ITEM FILHO` + Opção de remoção da estrutura vazia | Envio de componentes vazios que causam erro no software da máquina. |
| **Plugins de Máquinas** | Máquinas `2530` (ASPAN) / `2534` (NCB) | Validação da presença dos parâmetros de máquina no XML | Envio de pedidos para máquinas descalibradas ou incompatíveis. |
| **Consulta ERP / DB2** | Validação REST API & SQL DB2 | Cruzamento de itens com o catálogo e pedidos do ERP | Inclusão de itens descontinuados ou sem cadastro de estoque. |

---

### 5. 🤖 Auto-Fix Inteligente (Correção Automática de XML & DXF)

#### 🛠️ Auto-Fix em XML:
* **Preços e Quantidades:** Ajusta automaticamente quantidades zero para `1` e preços zero para `R$ 0,10` quando ativado nas opções.
* **Limpeza de Estrutura Vazia:** Remove nós pai de `<ITEM>` que não possuem furações ou componentes filhos (`Sem Item Filho`), sanitizando a estrutura XML.

#### 📐 Auto-Fix em DXF (Reescrita de Geometria Vetorial CAD):
* **Correção de Fresa Duplada 31mm e 37mm -> 18mm (`ES08`):** O módulo `dxf-tools.js` analisa o arquivo `.dxf` da peça na pasta de desenhos, localiza na seção `ENTITIES` os blocos de usinagem de duplado e reescreve a profundidade e diâmetro da ferramenta de 31mm/37mm para o padrão calibrado de 18mm.
* **Injeção Automática de Muxarabi (`MX008`):** Identifica as dimensões da peça (ex: 25x25, 40x25) e a espessura (18mm, 25mm), injetando a malha de usinagem de grade DXF diretamente na layer de usinagem da peça, sem intervenção humana.
* **Sincronização com Pasta Espelho (Mirror Sync) & Pasta de Cópia:** Após a modificação do arquivo DXF pelo robô, uma cópia atualizada é automaticamente enviada para a pasta espelho e pasta de cópia configurada, garantindo a integridade dos arquivos lidos pelo operador.

---

### 6. 📦 Processamento de Desenhos em Lote & Gestão de Diretórios
* **Modal de Desenhos em Lote (`BatchDrawingsModal`):** Permite abrir, consultar, editar e disparar múltiplos desenhos DXF simultaneamente para a pasta de usinagem.
* **Mapeamento Flexível de Diretórios:**
  * **Pasta de Desenhos DXF (Nesting)**
  * **Pasta de Desenho ASPAN**
  * **Pasta Espelho (Mirror)**
  * **Pasta de Cópia Manual/Automática**
* **Ação Direta:** Botão para abrir o arquivo DXF diretamente na pasta espelho através do explorador ou CAD.

---

### 7. 🎨 Drawer de Inspeção Detalhada & Edição Interativa

Ao clicar em qualquer pedido na interface React, um **Drawer interativo de alta produtividade** é exibido com abas especializadas:

* **Cores Coringa:** Interface otimizada com inputs padronizados, substituição rápida de siglas (`CG1`, `CG2`, `CORINGA1`) por cores do ERP e sistema de **Backup & Undo** de 1 clique.
* **Peças Dupladas (ES08):** Visualização de espessuras, status de usinagem e acionador de correção de fresa.
* **Itens do Pedido:** Tabela completa com itens pai/filho, edição de descrições e re-associação de arquivos `DESENHO`.
* **Pesquisa de Produtos ERP:** Modal integrado de busca no ERP corporativo por código ou descrição para inserção direta no pedido.
* **Lote de Pedidos de Compra (PO):** Filtragem e exibição isolada de itens em formato `POXXXXXX`.
* **ImportKey & Promob:** Verificação de chave de importação e download do arquivo `.promob`.
* **Muxarabi & Desenhos Especiais:** Visualizador e acionador direto dos desenhos DXF no software CAD padrão.

---

### 8. ⏰ Agendador de Tarefas & Relatórios Diários (Scheduler)

* **Relatórios Diários Automatizados:** O motor `reports-scheduler.js` gera automaticamente às **11:30** e **17:30** relatórios completos em formato **CSV** na pasta de relatórios.
* **Compatibilidade nativa com Excel (UTF-8 BOM):** Arquivos salvos com marca d'água de bytes `\uFEFF` para abertura direta no Microsoft Excel sem corrupção de acentuação.
* **Limpeza Programada de Pastas:** Rotina autônoma executada diariamente às **17:30** que limpa logs e arquivos temporários das pastas `ok`, `erro`, `log_proc` e `log_erro`, mantendo o servidor otimizado.

---

## 🏛️ Estrutura do Código Fonte

```
📦 Bartz-Analyzer
 ├── 🖥️ cjs-main.js                  # Arquivo de entrada do Processo Principal (Main Process Electron)
 ├── 🖥️ preload.js                   # Ponte IPC de segurança (contextBridge) entre Main e Renderer
 ├── 🖥️ watcher.js                   # Entry-point secundário de monitoramento
 ├── 🖥️ report-scheduler.js          # Agendador de tarefas independente
 ├── 📂 main/                        # Módulos Core do Processo Principal (Node.js)
 │    ├── 🔐 auth.js                 # Autenticação de usuários, sessões e permissões no MySQL
 │    ├── 🗄️ db2-search.js           # Conector nativo ODBC com IBM DB2 (bartznew) & busca em 3 tiers
 │    ├── 🛠️ dxf-tools.js            # Parser DXF, Injeção de Muxarabi, Correção Fresa Duplada & Busca DXF
 │    ├── 🔐 erp-auth.js             # Autenticação e tokens da API ERP corporativa
 │    ├── 🔎 erp-search.js           # Consulta de produtos/cores na API ERP e arquivos CSV
 │    ├── 🛡️ erp-validation.js       # Validação de integridade de itens do pedido com ERP
 │    ├── 🧰 helpers.js              # Funções utilitárias de I/O, resolução de caminhos UNC e IPC
 │    ├── 📜 history.js              # Gerenciador de histórico de processamento persistente (JSON)
 │    ├── ⏰ reports-scheduler.js     # Motor cron agendador de relatórios CSV e faxina de pastas
 │    ├── ⚙️ settings.js             # Gerenciamento de configurações armazenadas via electron-store
 │    ├── 🧠 state.js                # Estado global em memória do processo principal
 │    ├── 🔄 updater.js              # Integração de atualizações OTA com GitHub Releases
 │    ├── 👁️ watcher.js              # Monitoramento de sistema de arquivos com Chokidar
 │    ├── 📝 xml-editor.js           # Edição de XML: troca de coringas, referências, backup e undo
 │    └── ⚡ xml-processor.js        # Pipeline central: validação, geração de simplificado e auto-fix
 ├── 📂 src/                         # Processo de Renderização (Interface React 18 + Vite)
 │    ├── 🧩 components/             # Componentes modulares da Interface
 │    │    ├── 📊 Dashboard.tsx      # Dashboard principal (KPIs, Fila, Busca DXF com Pedido & Filtros)
 │    │    ├── ⚙️ ConfigurationScreen.tsx # Painel de Opções, Diretórios e Teste de Conexão DB2/MySQL
 │    │    ├── 📂 FileDetailDrawer.tsx# Drawer deslizante com abas especializadas e permissões
 │    │    ├── 🔍 BatchDrawingsModal.tsx # Modal de busca e cópia em lote de arquivos CAD e XMLs
 │    │    ├── 🌟 SpecialOrdersModal.tsx # Modal de gestão e acompanhamento de Pedidos Especiais
 │    │    ├── 🔐 LoginModal.tsx      # Modal de autenticação de usuários
 │    │    ├── 📈 ProcessingStats.tsx# Cards de métricas de engajamento e erros
 │    │    ├── 🏷️ AutoFixBadge.tsx   # Badges indicativos de correções efetuadas pelo robô
 │    │    ├── 🏷️ BadgeErro.tsx      # Badges com estilo e severidade de inconformidades
 │    │    └── 🗂️ drawer/            # Abas especializadas do Drawer
 │    │         ├── 🎨 CoringaSection.tsx       # Substituição de cores coringa e histórico
 │    │         ├── 📐 Es08Section.tsx          # Gestão e correção de peças dupladas 31/37mm
 │    │         ├── 🪟 MuxarabiSection.tsx      # Injeção e inspeção de gabaritos Muxarabi
 │    │         ├── 📋 ItemsSection.tsx         # Tabela de itens pai/filho e referências
 │    │         ├── 🌟 SpecialItemsSection.tsx  # Gestão de itens especiais da engenharia
 │    │         ├── 🔑 ImportKeySection.tsx     # Validação de chaves e download de .promob
 │    │         ├── 📦 PoItemsSection.tsx       # Filtro de pedidos de compra (PO)
 │    │         ├── 🔍 ErpSearchSection.tsx     # Busca de produtos e substituição rápida
 │    │         └── ⚙️ FileDetailTabs.tsx       # Controle e renderização de abas do Drawer
 │    ├── ⚓ hooks/                  # Custom React Hooks (IPC Communication & Store)
 │    ├── 🛠️ lib/                    # Lógica utilitária compartilhada (xml-logic.js)
 │    └── 🏷️ types/                  # Definições de Tipos TypeScript (Interfaces Globais)
 ├── 📂 Muxarabi/                    # Biblioteca de gabaritos vetoriais DXF por dimensão/espessura
 ├── 🧪 tests/                       # Testes unitários da lógica de parsing e validação XML (Vitest)
 ├── 🐳 Dockerfile                   # Configuração de container Linux para builds e testes CI/CD
 └── 🐳 docker-compose.yml           # Orquestração do container de desenvolvimento/testes
```

---

## 💻 Instalação & Desenvolvimento

### Pré-requisitos

* **Node.js** `v20.0.0` ou superior
* **npm** `v10.0.0` ou superior

### Passos para Execução Local

```bash
# 1. Clonar o repositório
git clone https://github.com/betolara1/Bartz-Analyzer.git
cd Bartz-Analyzer

# 2. Instalar as dependências do projeto
npm install

# 3. Iniciar o ambiente de desenvolvimento (React Vite + Electron em paralelo)
npm run dev
```

---

## 📦 Como Gerar o Executável de Produção (.exe)

A aplicação utiliza `electron-builder` configurado com `npmRebuild: false` e `asarUnpack` para empacotar binários nativos C++ de forma segura.

```bash
# Compilar o código React e gerar o instalador de produção em /release
npm run dist:win
```

### O que o processo de build realiza:
1. Executa `vite build` compilando a UI otimizada para a pasta `/dist`.
2. Empacota a aplicação incluindo os recursos vetoriais da pasta `Muxarabi/`.
3. Descompacta o driver nativo `ibm_db` e suas DLLs no diretório `app.asar.unpacked`.
4. Gera o instalador **`Bartz-Analyzer-Setup-6.0.0.exe`** dentro do diretório **`release/`**.

---

## 🧪 Suíte de Testes Unitários

```bash
# Executar a suíte de testes unitários
npm test
```

Os testes cobrem:
* Parsing de tags de pedidos e identificação de atributos ausentes.
* Detecção de itens `ES08` (duplado 31mm/37mm) e `MX008` (Muxarabi).
* Validação de regras de substituição de cores coringa (`CG1`/`CG2`).
* Validação de geração de XML simplificado.

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia | Versão | Aplicação |
| :--- | :--- | :--- | :--- |
| **Runtime Desktop** | **Electron** | `^37.3.1` | Execução nativa multi-processo Cross-Platform |
| **UI Framework** | **React** | `^18.3.24` | Interface componentizada e reativa |
| **Linguagem** | **TypeScript** | `^5.9.2` | Tipagem estática rigorosa no Renderer e IPC |
| **Bundler & Build Tool** | **Vite** | `^7.3.1` | Compilação ultrarrápida do frontend e HMR |
| **Estilização** | **Tailwind CSS** | `^3.4.17` | Sistema de design utility-first responsivo |
| **Banco de Dados ERP** | **IBM DB2 (`ibm_db`)** | `^4.0.1` | Conexão ODBC direta com banco bartznew para busca de pedidos |
| **Banco de Dados Auth** | **MySQL2** | `^3.23.2` | Autenticação e checagem de permissões de usuários |
| **Componentes UI** | **Radix UI** | `^1.1.0` | Primitivos acessíveis (Dialog, Tooltip, Select, Dropdown) |
| **Monitoramento I/O** | **Chokidar** | `^4.0.3` | Watcher de sistema de arquivos de alta performance |
| **Parser XML** | **fast-xml-parser** | `^5.2.5` | Parsing bidirecional de alta velocidade de documentos XML |
| **Manipulação DXF** | **dxf-parser / Custom** | `^1.1.2` | Leitura e reescrita de entidades vetoriais CAD |
| **Banco de Dados Local**| **Electron Store** | `^11.0.2` | Persistência de configurações e preferências do usuário |
| **Atualizador OTA** | **Electron Updater** | `^6.8.9` | Atualizações automáticas de versão via GitHub Releases |
| **Testes Unitários** | **Vitest** | `^3.2.4` | Runner de testes moderno e rápido baseado em ESM |

---

## 👨‍💻 Autor & Engenharia de Desenvolvimento

Desenvolvido por **Beto Lara** — *Backend & Desktop Software Engineer*

[![GitHub](https://img.shields.io/badge/GitHub-betolara1-181717?style=for-the-badge&logo=github)](https://github.com/betolara1)

---

<div align="center">

**Bartz Analyzer** — *Engenharia de Software de Alta Performance Garantindo a Continuidade e Precisão do Chão de Fábrica.*

> **Nota:** Este projeto utiliza o agente de inteligência artificial **Antigravity** (Google DeepMind) para aceleração de desenvolvimento, arquitetura de sistemas, refinamento estético de interface e garantia de conformidade com boas práticas de engenharia de software.

</div>
