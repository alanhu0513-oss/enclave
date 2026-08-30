#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../data");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "../backups");
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || "30", 10);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupDatabase() {
  ensureDir(BACKUP_DIR);

  const files = ["enclave.json"];
  const timestamp = getTimestamp();
  let backedUp = 0;

  for (const file of files) {
    const src = path.join(DATA_DIR, file);
    if (!fs.existsSync(src)) {
      console.log(`[BACKUP] Skipping ${file} (not found)`);
      continue;
    }

    const dest = path.join(BACKUP_DIR, `${timestamp}_${file}`);
    try {
      fs.copyFileSync(src, dest);
      const stats = fs.statSync(dest);
      console.log(`[BACKUP] ${file} → ${dest} (${(stats.size / 1024).toFixed(1)} KB)`);
      backedUp++;
    } catch (e) {
      console.error(`[BACKUP] Failed to backup ${file}:`, e.message);
    }
  }

  cleanupOldBackups();
  return backedUp;
}

function cleanupOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        console.log(`[BACKUP] Cleaned up old backup: ${file}`);
      } catch (e) {
        console.error(`[BACKUP] Failed to delete ${file}:`, e.message);
      }
    }
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .map((f) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        name: f,
        size: stats.size,
        created: stats.mtime.toISOString()
      };
    });
}

function restoreBackup(filename) {
  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) {
    console.error(`[BACKUP] Backup not found: ${filename}`);
    return false;
  }

  const dest = path.join(DATA_DIR, "enclave.json");
  try {
    fs.copyFileSync(src, dest);
    console.log(`[BACKUP] Restored from ${filename}`);
    return true;
  } catch (e) {
    console.error(`[BACKUP] Restore failed:`, e.message);
    return false;
  }
}

if (require.main === module) {
  const cmd = process.argv[2];
  switch (cmd) {
    case "backup":
      const count = backupDatabase();
      console.log(`[BACKUP] Completed: ${count} files backed up`);
      break;
    case "list":
      const backups = listBackups();
      console.log(`[BACKUP] ${backups.length} backups:`);
      backups.forEach((b) => console.log(`  ${b.name} (${(b.size / 1024).toFixed(1)} KB) - ${b.created}`));
      break;
    case "restore":
      const filename = process.argv[3];
      if (!filename) {
        console.error("[BACKUP] Usage: node backup.js restore <filename>");
        process.exit(1);
      }
      restoreBackup(filename);
      break;
    default:
      console.log("[BACKUP] Commands: backup, list, restore <filename>");
  }
}

module.exports = { backupDatabase, listBackups, restoreBackup };
