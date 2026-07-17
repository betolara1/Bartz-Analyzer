// main/state.js
// Estado mutável compartilhado entre os módulos do processo principal.
// É um objeto (não variáveis soltas) para que a mutação feita em um módulo
// (ex: cjs-main.js define state.win na criação da janela) seja visível
// imediatamente em todos os outros módulos que o importaram.
const { app } = require("electron");
const path = require("path");

const state = {
  win: null,
  watcher: null,
  currentCfg: null,
};

// Caminhos de arquivos persistidos em userData (constantes, não mudam em runtime)
state.CFG_FILE = path.join(app.getPath("userData"), "settings.json");
state.HISTORY_FILE = path.join(app.getPath("userData"), "analysis-history.json");
state.HISTORY_MAX_ROWS = 3000;
state.REPLACE_BACKUP_DIR = path.join(app.getPath("userData"), "backups");
state.REPLACE_HISTORY_FILE = path.join(app.getPath("userData"), "replace-history.json");

module.exports = state;
