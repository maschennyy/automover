"use strict";
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
let _micromatch = null;
function getMicromatch() {
  if (_micromatch) return _micromatch;
  try {
    _micromatch = require("micromatch");
  } catch {
    _micromatch = null;
  }
  return _micromatch;
}
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function normalisePath(p) {
  return path.resolve(p).replace(/\\/g, "/");
}
function samePath(a, b) {
  return normalisePath(a) === normalisePath(b);
}
function createDirectoryIfNotExists(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (err) {
    if (err.code === "EEXIST") return { success: true };
    throw new Error(`Gagal membuat folder "${dirPath}": ${err.message}`);
  }
}
function resolveDestinationPath(destinationDir, fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = path.join(destinationDir, fileName);
  if (!fs.existsSync(candidate)) return candidate;
  let counter = 1;
  while (true) {
    candidate = path.join(destinationDir, `${base}_${counter}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter++;
    if (counter > 9999) {
      throw new Error(
        `Terlalu banyak file duplikat untuk "${fileName}" di "${destinationDir}"`
      );
    }
  }
}
function _renameCrossDevice(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code === "EXDEV") {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
}
function _withRetry(fn, fileName, maxRetries = 3, delayMs = 500) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;
      const retryable = err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES";
      if (!retryable || attempt === maxRetries) throw err;
      sleepSync(delayMs);
    }
  }
  throw lastErr;
}
function moveFile(sourcePath, destinationDir, rule) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File sumber tidak ditemukan: "${sourcePath}"`);
  }
  const srcStat = fs.statSync(sourcePath);
  if (!srcStat.isFile()) {
    throw new Error(`Path sumber bukan file: "${sourcePath}"`);
  }
  if (samePath(path.dirname(sourcePath), destinationDir)) {
    throw new Error(
      `Folder sumber dan tujuan tidak boleh sama: "${destinationDir}"`
    );
  }
  if (!fs.existsSync(destinationDir)) {
    if (rule.autoCreateFolder) {
      createDirectoryIfNotExists(destinationDir);
    } else {
      throw new Error(
        `Folder tujuan tidak ada dan autoCreateFolder dinonaktifkan: "${destinationDir}"`
      );
    }
  }
  const fileName = path.basename(sourcePath);
  const finalDestPath = resolveDestinationPath(destinationDir, fileName);
  _withRetry(
    () => _renameCrossDevice(sourcePath, finalDestPath)
  );
  return {
    id: uuidv4(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ruleId: rule.id,
    fileName,
    from: sourcePath,
    to: finalDestPath,
    action: "move",
    undone: false
  };
}
function copyFile(sourcePath, destinationDir, rule) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File sumber tidak ditemukan: "${sourcePath}"`);
  }
  const srcStat = fs.statSync(sourcePath);
  if (!srcStat.isFile()) {
    throw new Error(`Path sumber bukan file: "${sourcePath}"`);
  }
  if (samePath(path.dirname(sourcePath), destinationDir)) {
    throw new Error(
      `Folder sumber dan tujuan tidak boleh sama: "${destinationDir}"`
    );
  }
  if (!fs.existsSync(destinationDir)) {
    if (rule.autoCreateFolder) {
      createDirectoryIfNotExists(destinationDir);
    } else {
      throw new Error(
        `Folder tujuan tidak ada dan autoCreateFolder dinonaktifkan: "${destinationDir}"`
      );
    }
  }
  const fileName = path.basename(sourcePath);
  const finalDestPath = resolveDestinationPath(destinationDir, fileName);
  _withRetry(
    () => fs.copyFileSync(sourcePath, finalDestPath, fs.constants.COPYFILE_EXCL)
  );
  return {
    id: uuidv4(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ruleId: rule.id,
    fileName,
    from: sourcePath,
    to: finalDestPath,
    action: "copy",
    undone: false
  };
}
function matchesRule(fileName, rule) {
  const filters = rule.filters || {};
  const hasExtFilter = Array.isArray(filters.extensions) && filters.extensions.length > 0;
  const hasPatternFilter = typeof filters.namePattern === "string" && filters.namePattern.trim() !== "";
  if (!hasExtFilter && !hasPatternFilter) return true;
  let extMatch = true;
  let patternMatch = true;
  if (hasExtFilter) {
    const fileExt = path.extname(fileName).toLowerCase();
    const normalised = filters.extensions.map(
      (e) => (e.startsWith(".") ? e : `.${e}`).toLowerCase()
    );
    extMatch = normalised.includes(fileExt);
  }
  if (hasPatternFilter) {
    const pattern = filters.namePattern.trim();
    const mm = getMicromatch();
    if (mm) {
      patternMatch = mm.isMatch(fileName.toLowerCase(), pattern.toLowerCase(), {
        nocase: true,
        dot: true,
        // allow matching dotfiles
        windows: true
        // normalise Windows paths
      });
    } else {
      patternMatch = _globMatch(fileName, pattern);
    }
  }
  return extMatch && patternMatch;
}
function _globMatch(fileName, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  const regex = new RegExp(`^${escaped}$`, "i");
  return regex.test(fileName);
}
function scanAndSort(sourceDirectory, rules) {
  const result = { success: [], errors: [] };
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Folder sumber tidak ditemukan: "${sourceDirectory}"`);
  }
  const dirStat = fs.statSync(sourceDirectory);
  if (!dirStat.isDirectory()) {
    throw new Error(`Path bukan folder: "${sourceDirectory}"`);
  }
  let entries;
  try {
    entries = fs.readdirSync(sourceDirectory, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Tidak bisa membaca folder "${sourceDirectory}": ${err.message}`);
  }
  const files = entries.filter((e) => e.isFile());
  const activeRules = (rules || []).filter((r) => r.isActive === true);
  if (activeRules.length === 0 || files.length === 0) {
    return result;
  }
  for (const fileEntry of files) {
    const fileName = fileEntry.name;
    const sourcePath = path.join(sourceDirectory, fileName);
    for (const rule of activeRules) {
      if (rule.watchFolder && !samePath(rule.watchFolder, sourceDirectory)) {
        continue;
      }
      if (!matchesRule(fileName, rule)) continue;
      try {
        let logEntry;
        if (rule.action === "copy") {
          logEntry = copyFile(sourcePath, rule.destination, rule);
        } else {
          logEntry = moveFile(sourcePath, rule.destination, rule);
        }
        result.success.push(logEntry);
        if (rule.action === "move") break;
      } catch (err) {
        result.errors.push({
          fileName,
          ruleId: rule.id,
          error: err.message
        });
        if (!fs.existsSync(sourcePath)) break;
      }
    }
  }
  return result;
}
function undoAction(logEntry) {
  if (logEntry.undone === true) {
    throw new Error(`Operasi ini sudah dibatalkan sebelumnya: "${logEntry.fileName}"`);
  }
  if (!fs.existsSync(logEntry.to)) {
    throw new Error(
      `File tidak ditemukan di lokasi tujuan — mungkin sudah dihapus atau dipindahkan manual: "${logEntry.to}"`
    );
  }
  if (logEntry.action === "copy") {
    try {
      fs.unlinkSync(logEntry.to);
    } catch (err) {
      throw new Error(
        `Gagal menghapus salinan file "${logEntry.to}": ${err.message}`
      );
    }
  } else {
    const originalDir = path.dirname(logEntry.from);
    if (!fs.existsSync(originalDir)) {
      try {
        fs.mkdirSync(originalDir, { recursive: true });
      } catch (err) {
        throw new Error(
          `Tidak bisa membuat ulang folder asal "${originalDir}": ${err.message}`
        );
      }
    }
    if (fs.existsSync(logEntry.from)) {
      throw new Error(
        `File sudah ada di lokasi asal — tidak bisa dikembalikan tanpa menimpa: "${logEntry.from}"`
      );
    }
    try {
      _renameCrossDevice(logEntry.to, logEntry.from);
    } catch (err) {
      throw new Error(
        `Gagal mengembalikan file "${logEntry.fileName}" ke lokasi asal: ${err.message}`
      );
    }
  }
  const updatedLog = { ...logEntry, undone: true };
  return { success: true, updatedLog };
}
module.exports = {
  createDirectoryIfNotExists,
  resolveDestinationPath,
  moveFile,
  copyFile,
  matchesRule,
  scanAndSort,
  undoAction
};
//# sourceMappingURL=fileOps.js.map
