const fs = require('fs');
const path = require('path');
const env = require('../config/env');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function rotateFileIfNeeded(filePath, maxBytes = env.jsonlLogMaxBytes, backupFiles = env.jsonlLogMaxBackupFiles) {
  if (!maxBytes || maxBytes <= 0) return false;
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  if (stat.size < maxBytes) return false;

  const backups = Math.max(Number(backupFiles) || 0, 0);
  if (backups <= 0) {
    fs.truncateSync(filePath, 0);
    return true;
  }

  const oldest = `${filePath}.${backups}`;
  if (fs.existsSync(oldest)) fs.rmSync(oldest, { force: true });

  for (let index = backups - 1; index >= 1; index -= 1) {
    const current = `${filePath}.${index}`;
    const next = `${filePath}.${index + 1}`;
    if (fs.existsSync(current)) fs.renameSync(current, next);
  }

  fs.renameSync(filePath, `${filePath}.1`);
  return true;
}

function appendJsonLine(filePath, entry) {
  ensureDir(filePath);
  rotateFileIfNeeded(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function readJsonLines(filePath, { limit = 0 } = {}) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const safeLimit = Math.max(Number(limit) || 0, 0);
  const selected = safeLimit > 0 ? lines.slice(-safeLimit) : lines;
  return selected.map(parseLine).filter(Boolean);
}

module.exports = {
  ensureDir,
  rotateFileIfNeeded,
  appendJsonLine,
  readJsonLines
};
