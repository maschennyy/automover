'use strict'

/**
 * fileOps.js — AutoMover File Operations Engine
 *
 * Pure Node.js module. No Electron, no UI.
 * Called from the Electron main process and fileWatcher.js.
 */

const fs   = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

let _micromatch = null
function getMicromatch() {
  if (_micromatch) return _micromatch
  try {
    _micromatch = require('micromatch')
  } catch {
    _micromatch = null
  }
  return _micromatch
}

const CATEGORY_MAP = {
  Documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'md', 'epub', 'mobi'],
  Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg', 'heic', 'ico', 'raw', 'psd', 'ai'],
  Videos: ['mp4', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'mpeg', 'mpg'],
  Audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma', 'amr'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'],
  Installers: ['exe', 'msi', 'apk', 'dmg', 'pkg', 'deb', 'rpm', 'appx'],
  Code: ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'sql', 'sh', 'bat', 'ps1'],
  Fonts: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function normalisePath(p) {
  return path.resolve(p).replace(/\\/g, '/')
}

function samePath(a, b) {
  return normalisePath(a) === normalisePath(b)
}

function createDirectoryIfNotExists(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (err) {
    if (err.code === 'EEXIST') return { success: true }
    throw new Error(`Gagal membuat folder "${dirPath}": ${err.message}`)
  }
}

function resolveDestinationPath(destinationDir, fileName) {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let candidate = path.join(destinationDir, fileName)
  if (!fs.existsSync(candidate)) return candidate

  let counter = 1
  while (true) {
    candidate = path.join(destinationDir, `${base}_${counter}${ext}`)
    if (!fs.existsSync(candidate)) return candidate
    counter++
    if (counter > 9999) throw new Error(`Terlalu banyak file duplikat untuk "${fileName}" di "${destinationDir}"`)
  }
}

function resolvePreviewDestinationPath(destinationDir, fileName, reservedPaths = new Set()) {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let candidate = path.join(destinationDir, fileName)

  const isTaken = (p) => fs.existsSync(p) || reservedPaths.has(normalisePath(p))
  if (!isTaken(candidate)) return { path: candidate, conflict: false, renamed: false }

  let counter = 1
  while (true) {
    candidate = path.join(destinationDir, `${base}_${counter}${ext}`)
    if (!isTaken(candidate)) return { path: candidate, conflict: true, renamed: true }
    counter++
    if (counter > 9999) throw new Error(`Terlalu banyak file duplikat untuk "${fileName}" di "${destinationDir}"`)
  }
}

function _renameCrossDevice(src, dest) {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    } else {
      throw err
    }
  }
}

function _withRetry(fn, fileName, maxRetries = 3, delayMs = 500) {
  let lastErr
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return fn()
    } catch (err) {
      lastErr = err
      const retryable = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES'
      if (!retryable || attempt === maxRetries) throw err
      sleepSync(delayMs)
    }
  }
  throw lastErr
}

function safeFolderName(name) {
  return String(name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 80) || 'unknown'
}

function getFileExtension(fileName) {
  return path.extname(fileName).replace(/^\./, '').toLowerCase()
}

function getExtensionFolderName(fileName) {
  return safeFolderName(getFileExtension(fileName) || 'no-extension')
}

function getCategoryFolderName(fileName) {
  const ext = getFileExtension(fileName)
  if (!ext) return 'Others'
  for (const [category, extensions] of Object.entries(CATEGORY_MAP)) {
    if (extensions.includes(ext)) return category
  }
  return 'Others'
}

function hasGlobSyntax(pattern) {
  return /[*?\[\]{}()!+@]/.test(pattern)
}

function getNamePatterns(rule) {
  const raw = rule.filters?.namePattern
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean)
  if (typeof raw !== 'string') return []
  return raw.split(',').map(v => v.trim()).filter(Boolean)
}

function getNameFolderName(rule) {
  const folderName = rule.nameFolder || rule.nameFolderName || rule.folderNameFromPattern
  if (typeof folderName === 'string' && folderName.trim()) return safeFolderName(folderName.trim())

  const firstPattern = getNamePatterns(rule)[0]
  if (!firstPattern) return 'Matched-Name'

  return safeFolderName(firstPattern.replace(/[*?]/g, '').replace(/^\.+|\.+$/g, '').trim())
}

function getOrganizeMode(rule) {
  const mode = rule.organizeBy || rule.groupBy || rule.destinationMode
  if (mode === 'none' || mode === 'single-folder' || mode === 'direct') return 'none'
  if (mode === 'name' || mode === 'name-pattern' || mode === 'by-name' || mode === 'filter-name') return 'name'
  if (mode === 'category' || mode === 'smart-category' || mode === 'by-category') return 'category'
  if (mode === 'extension' || mode === 'by-extension') return 'extension'
  return 'extension'
}

function getDestinationBaseDir(sourcePath, destinationRoot, rule) {
  const sourceFolder = path.dirname(sourcePath)
  const baseMode = rule.destinationBase || rule.destinationRoot || 'custom'
  if (baseMode === 'source' || baseMode === 'watch-folder') return sourceFolder

  const root = destinationRoot || rule.destination
  if (!root) throw new Error('Folder tujuan belum diisi')
  return root
}

function resolveRuleDestinationDir(sourcePath, destinationRoot, rule) {
  const fileName = path.basename(sourcePath)
  const baseDir = getDestinationBaseDir(sourcePath, destinationRoot, rule)
  const organizeMode = getOrganizeMode(rule)

  if (organizeMode === 'name') return path.join(baseDir, getNameFolderName(rule))
  if (organizeMode === 'category') return path.join(baseDir, getCategoryFolderName(fileName))
  if (organizeMode === 'extension') return path.join(baseDir, getExtensionFolderName(fileName))
  return baseDir
}

function validateSourceFile(sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new Error(`File sumber tidak ditemukan: "${sourcePath}"`)
  const srcStat = fs.statSync(sourcePath)
  if (!srcStat.isFile()) throw new Error(`Path sumber bukan file: "${sourcePath}"`)
}

function ensureDestinationReady(sourcePath, destinationDir, rule) {
  if (samePath(path.dirname(sourcePath), destinationDir)) {
    throw new Error(`Folder sumber dan tujuan akhir tidak boleh sama: "${destinationDir}"`)
  }
  if (!fs.existsSync(destinationDir)) {
    if (rule.autoCreateFolder !== false) createDirectoryIfNotExists(destinationDir)
    else throw new Error(`Folder tujuan tidak ada dan autoCreateFolder dinonaktifkan: "${destinationDir}"`)
  }
}

function moveFile(sourcePath, destinationDir, rule) {
  validateSourceFile(sourcePath)
  const finalDestinationDir = resolveRuleDestinationDir(sourcePath, destinationDir, rule)
  ensureDestinationReady(sourcePath, finalDestinationDir, rule)
  const fileName = path.basename(sourcePath)
  const finalDestPath = resolveDestinationPath(finalDestinationDir, fileName)
  _withRetry(() => _renameCrossDevice(sourcePath, finalDestPath), fileName)
  return { id: uuidv4(), timestamp: new Date().toISOString(), ruleId: rule.id, fileName, from: sourcePath, to: finalDestPath, action: 'move', undone: false }
}

function copyFile(sourcePath, destinationDir, rule) {
  validateSourceFile(sourcePath)
  const finalDestinationDir = resolveRuleDestinationDir(sourcePath, destinationDir, rule)
  ensureDestinationReady(sourcePath, finalDestinationDir, rule)
  const fileName = path.basename(sourcePath)
  const finalDestPath = resolveDestinationPath(finalDestinationDir, fileName)
  _withRetry(() => fs.copyFileSync(sourcePath, finalDestPath, fs.constants.COPYFILE_EXCL), fileName)
  return { id: uuidv4(), timestamp: new Date().toISOString(), ruleId: rule.id, fileName, from: sourcePath, to: finalDestPath, action: 'copy', undone: false }
}

function matchesNamePattern(fileName, pattern) {
  const trimmed = String(pattern || '').trim()
  if (!trimmed) return true
  const lowerFileName = fileName.toLowerCase()
  const lowerPattern = trimmed.toLowerCase()
  if (!hasGlobSyntax(trimmed)) return lowerFileName.includes(lowerPattern)

  const mm = getMicromatch()
  if (mm) return mm.isMatch(lowerFileName, lowerPattern, { nocase: true, dot: true, windows: true })
  return _globMatch(fileName, trimmed)
}

function matchesRule(fileName, rule) {
  const filters = rule.filters || {}
  const hasExtFilter = Array.isArray(filters.extensions) && filters.extensions.length > 0
  const namePatterns = getNamePatterns(rule)
  const hasPatternFilter = namePatterns.length > 0
  if (!hasExtFilter && !hasPatternFilter) return true

  let extMatch = true
  let patternMatch = true

  if (hasExtFilter) {
    const fileExt = path.extname(fileName).toLowerCase()
    const normalised = filters.extensions.map(e => (e.startsWith('.') ? e : `.${e}`).toLowerCase())
    extMatch = normalised.includes(fileExt)
  }

  if (hasPatternFilter) patternMatch = namePatterns.some(pattern => matchesNamePattern(fileName, pattern))
  return extMatch && patternMatch
}

function _globMatch(fileName, pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  const regex = new RegExp(`^${escaped}$`, 'i')
  return regex.test(fileName)
}

function readTopLevelFiles(sourceDirectory) {
  if (!fs.existsSync(sourceDirectory)) throw new Error(`Folder sumber tidak ditemukan: "${sourceDirectory}"`)
  const dirStat = fs.statSync(sourceDirectory)
  if (!dirStat.isDirectory()) throw new Error(`Path bukan folder: "${sourceDirectory}"`)

  let entries
  try {
    entries = fs.readdirSync(sourceDirectory, { withFileTypes: true })
  } catch (err) {
    throw new Error(`Tidak bisa membaca folder "${sourceDirectory}": ${err.message}`)
  }
  return entries.filter(e => e.isFile())
}

function scanAndSort(sourceDirectory, rules) {
  const result = { success: [], errors: [] }
  const files = readTopLevelFiles(sourceDirectory)
  const activeRules = (rules || []).filter(r => r.isActive === true)
  if (activeRules.length === 0 || files.length === 0) return result

  for (const fileEntry of files) {
    const fileName = fileEntry.name
    const sourcePath = path.join(sourceDirectory, fileName)

    for (const rule of activeRules) {
      if (rule.watchFolder && !samePath(rule.watchFolder, sourceDirectory)) continue
      if (!matchesRule(fileName, rule)) continue

      try {
        const logEntry = rule.action === 'copy' ? copyFile(sourcePath, rule.destination, rule) : moveFile(sourcePath, rule.destination, rule)
        result.success.push(logEntry)
        if (rule.action !== 'copy') break
      } catch (err) {
        result.errors.push({ fileName, ruleId: rule.id, error: err.message })
        if (!fs.existsSync(sourcePath)) break
      }
    }
  }
  return result
}

function previewScan(sourceDirectory, rules, reservedPaths = new Set()) {
  const items = []
  const errors = []
  const files = readTopLevelFiles(sourceDirectory)
  const activeRules = (rules || []).filter(r => r.isActive === true)

  for (const fileEntry of files) {
    const fileName = fileEntry.name
    const sourcePath = path.join(sourceDirectory, fileName)
    let matched = false

    for (const rule of activeRules) {
      if (rule.watchFolder && !samePath(rule.watchFolder, sourceDirectory)) continue
      if (!matchesRule(fileName, rule)) continue

      matched = true
      try {
        const finalDestinationDir = resolveRuleDestinationDir(sourcePath, rule.destination, rule)

        if (samePath(path.dirname(sourcePath), finalDestinationDir)) {
          items.push({
            id: uuidv4(), status: 'error', fileName, sourcePath, destinationPath: '', destinationFolder: finalDestinationDir,
            ruleId: rule.id, ruleName: rule.name || rule.id, action: rule.action || 'move',
            message: `Folder sumber dan tujuan akhir sama: ${finalDestinationDir}`,
            willCreateFolder: false, conflict: false, renamed: false,
          })
          if ((rule.action || 'move') !== 'copy') break
          continue
        }

        const resolved = resolvePreviewDestinationPath(finalDestinationDir, fileName, reservedPaths)
        reservedPaths.add(normalisePath(resolved.path))
        const willCreateFolder = !fs.existsSync(finalDestinationDir)

        items.push({
          id: uuidv4(), status: willCreateFolder && rule.autoCreateFolder === false ? 'error' : 'planned',
          fileName, sourcePath, destinationPath: resolved.path, destinationFolder: finalDestinationDir,
          ruleId: rule.id, ruleName: rule.name || rule.id, action: rule.action || 'move',
          message: willCreateFolder
            ? (rule.autoCreateFolder === false ? 'Folder tujuan belum ada dan auto-create nonaktif' : 'Folder tujuan akan dibuat saat run')
            : (resolved.renamed ? 'Nama bentrok, file akan diberi suffix otomatis' : 'Siap diproses'),
          willCreateFolder, conflict: resolved.conflict, renamed: resolved.renamed,
        })

        if ((rule.action || 'move') !== 'copy') break
      } catch (err) {
        errors.push({ fileName, sourcePath, ruleId: rule.id, error: err.message })
        items.push({
          id: uuidv4(), status: 'error', fileName, sourcePath, destinationPath: '', destinationFolder: '',
          ruleId: rule.id, ruleName: rule.name || rule.id, action: rule.action || 'move',
          message: err.message, willCreateFolder: false, conflict: false, renamed: false,
        })
        break
      }
    }

    if (!matched) {
      // Keep preview focused: unmatched files are not shown as rows, but counted in summary elsewhere if needed later.
    }
  }

  return { items, errors }
}

function previewRules(rules) {
  const activeRules = (rules || []).filter(r => r.isActive === true)
  const folders = [...new Set(activeRules.map(r => r.watchFolder).filter(Boolean))]
  const reservedPaths = new Set()
  const result = {
    success: true,
    generatedAt: new Date().toISOString(),
    items: [],
    errors: [],
    summary: { planned: 0, error: 0, createFolders: 0, conflicts: 0, renamed: 0, folders: folders.length },
  }

  for (const folder of folders) {
    try {
      const folderResult = previewScan(folder, activeRules, reservedPaths)
      result.items.push(...folderResult.items)
      result.errors.push(...folderResult.errors)
    } catch (err) {
      result.errors.push({ folder, error: err.message })
    }
  }

  result.summary.planned = result.items.filter(i => i.status === 'planned').length
  result.summary.error = result.items.filter(i => i.status === 'error').length + result.errors.length
  result.summary.createFolders = result.items.filter(i => i.willCreateFolder && i.status === 'planned').length
  result.summary.conflicts = result.items.filter(i => i.conflict).length
  result.summary.renamed = result.items.filter(i => i.renamed).length
  return result
}

function undoAction(logEntry) {
  if (logEntry.undone === true) throw new Error(`Operasi ini sudah dibatalkan sebelumnya: "${logEntry.fileName}"`)
  if (!fs.existsSync(logEntry.to)) throw new Error(`File tidak ditemukan di lokasi tujuan — mungkin sudah dihapus atau dipindahkan manual: "${logEntry.to}"`)

  if (logEntry.action === 'copy') {
    try {
      fs.unlinkSync(logEntry.to)
    } catch (err) {
      throw new Error(`Gagal menghapus salinan file "${logEntry.to}": ${err.message}`)
    }
  } else {
    const originalDir = path.dirname(logEntry.from)
    if (!fs.existsSync(originalDir)) {
      try { fs.mkdirSync(originalDir, { recursive: true }) }
      catch (err) { throw new Error(`Tidak bisa membuat ulang folder asal "${originalDir}": ${err.message}`) }
    }
    if (fs.existsSync(logEntry.from)) throw new Error(`File sudah ada di lokasi asal — tidak bisa dikembalikan tanpa menimpa: "${logEntry.from}"`)
    try { _renameCrossDevice(logEntry.to, logEntry.from) }
    catch (err) { throw new Error(`Gagal mengembalikan file "${logEntry.fileName}" ke lokasi asal: ${err.message}`) }
  }
  return { success: true, updatedLog: { ...logEntry, undone: true } }
}

module.exports = {
  CATEGORY_MAP,
  createDirectoryIfNotExists,
  resolveDestinationPath,
  resolveRuleDestinationDir,
  getExtensionFolderName,
  getCategoryFolderName,
  getNameFolderName,
  moveFile,
  copyFile,
  matchesRule,
  scanAndSort,
  previewScan,
  previewRules,
  undoAction,
}
