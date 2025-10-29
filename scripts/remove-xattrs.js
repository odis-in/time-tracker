const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  const appPath = context.appOutDir;
  console.log(`🧼 Limpiando atributos extendidos en: ${appPath}`);
  execSync(`xattr -cr "${appPath}"`);
};