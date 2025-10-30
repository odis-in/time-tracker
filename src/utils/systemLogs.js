const fs = require("fs");
const path = require("path");
const currentDate = new Date().toLocaleDateString("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});


const LOG_DIR = path.join(__dirname, "../../../", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function clearOldLogFile() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const stats = fs.statSync(LOG_FILE);
      const modifiedDate = new Date(stats.mtime).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Si el archivo fue modificado otro día → lo eliminamos
      if (modifiedDate !== currentDate) {
        fs.unlinkSync(LOG_FILE);
        console.log(`[LOGGER] Se eliminó el log antiguo (${modifiedDate})`);
      }
    } catch (err) {
      console.error("[LOGGER ERROR] No se pudo verificar o eliminar el archivo de log:", err);
    }
  }
}

clearOldLogFile();


function getLocalTimestamp() {
  return new Date().toLocaleString();
}


function writeToLogFile(level, msg) {
  const logEntry = `[${level}] ${getLocalTimestamp()} - ${msg}\n`;
  fs.appendFile(LOG_FILE, logEntry, (err) => {
    if (err) {
      console.error("[LOGGER ERROR] No se pudo escribir en el archivo de logs:", err);
    }
  });
}

function systemLogger() {
  return {
    info: function (msg) {
      const logEntry = `[INFO]  ${getLocalTimestamp()} - ${msg}`;
      console.log(logEntry);
      // writeToLogFile("INFO", msg);
    },

    warn: function (msg) {
      const logEntry = `[WARN]  ${getLocalTimestamp()} - ${msg}`;
      console.warn(logEntry);
      // writeToLogFile("WARN", msg);
    },

    error: function (msg) {
      const logEntry = `[ERROR] ${getLocalTimestamp()} - ${msg}`;
      console.error(logEntry);
      // writeToLogFile("ERROR", msg);
    },
  };
}

module.exports = { systemLogger };