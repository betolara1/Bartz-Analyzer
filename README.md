
  # Bartz Analyzer - Sistema de Monitoramento XML

  Aplicativo Electron + Vite para monitoramento e verificação de arquivos XML (fluxo interno para validações, correções automáticas e ajustes manuais).

  O design original está disponível em Figma: https://www.figma.com/design/cyPiS70Dbr7of4AXm6VSH8/Bartz-Analyzer---Sistema-de-Monitoramento-XML

  ## Pré-requisitos

  - Node.js (>=16) e npm
  - Windows / macOS / Linux (o app foi desenvolvido com foco em Windows; caminhos UNC e explorer são suportados)

  ## Instalação e execução em desenvolvimento

  No diretório do projeto:

  ```powershell
  npm install
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

  ### Cor Coringa (detecção e ajuste manual)

  - Quando o validador detectar tokens de "cor coringa" (ex.: `PAINEL_CG1_06`, etc.) o arquivo receberá a tag `COR CORINGA` e o drawer de detalhes mostrará um painel "Cor Coringa detectada".
  - O select nessa área mostra somente as cores coringa que foram realmente encontradas no XML (a lista é extraída do próprio arquivo durante a validação).
  - Para trocar:
    1. Selecione a cor coringa no select (apenas itens detectados aparecem).
    2. Informe o valor desejado em "Substituir por".
    3. Clique em "Trocar" — o app faz um backup automático do arquivo, aplica a substituição no arquivo físico e reprocessa o arquivo.
    4. Depois da troca, clique em "Atualizar arquivo" se necessário para forçar reprocessamento; o painel será atualizado com os novos dados (o select deixará de listar as cores que já foram substituídas).

  ### Desfazer (Undo)

  - Após uma substituição bem-sucedida o app cria um backup em uma pasta de backups dentro do diretório de dados do usuário do app (valor retornado por `app.getPath('userData')`).
  - É possível desfazer a última troca (por arquivo) clicando em "Desfazer última troca" no drawer — isso restaura o backup e reprocessa o arquivo.

  Local dos backups e histórico
  - Backups: `<userData>/backups/` — ex.: `%APPDATA%\\<appname>\\backups\\` no Windows.
  - Histórico: `<userData>/replace-history.json` — registra cada operação (timestamp, token trocado, backupPath, undo flag).

  ## Dicas e solução de problemas

  - Se o select ainda mostrar a cor antiga depois de trocar, use o botão "Atualizar arquivo" no drawer — isso força reprocessamento e atualização dos dados exibidos.
  - Se o arquivo tiver sido movido automaticamente para a pasta OK/Erro, o sistema de desfazer tenta casar o histórico por basename (nome do arquivo) como fallback.
  - Logs de erro do processo de validação são gravados nas pastas configuradas em *Logs - Errors* e *Logs - Processed* (se configuradas).

  ## Contribuições

  Sinta-se à vontade para abrir PRs. Mantenha as mudanças pequenas e compatíveis com o estilo do projeto.

  ## Licença

  Coloque aqui a licença do projeto (ex.: MIT) se aplicável.

  