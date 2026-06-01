'use strict'

/**
 * fileOps.js — AutoMover File Operations Engine
 *
 * Pure Node.js module. No Electron, no UI, no side effects outside the filesystem.
 * Called from the Electron main process (index.js) and fileWatcher.js.
 *
 * Dependencies: fs, path, os (built-in) + micromatch (npm)
 */

const fs   = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// ─── micromatch: lazy-require with graceful fallback ─────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Synchronous sleep using Atomics.wait on a shared buffer.
 * Works in Node.js main thread. Do NOT call from renderer process.
 * @param {number} ms - milliseconds to sleep
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Normalise a path to use forward slashes and resolve to absolute.
 * @param {string} p
 * @returns {string}
 */
function normalisePath(p) {
  return path.resolve(p).replace(/\\/g, '/')
}

/**
 * Return true if two resolved paths point to the same location.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function samePath(a, b) {
  return normalisePath(a) === normalisePath(b)
}

// ─── 1. createDirectoryIfNotExists ────────────────────────────────────────────

/**
 * Create a directory (and all parents) if it does not already exist.
 *
 * @param {string} dirPath - Absolute path to the directory to create.
 * @returns {{ success: true }}
 * @throws {Error} if creation fails for any reason other than the dir already existing.
 */
function createDirectoryIfNotExists(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (err) {
    // EEXIST is fine — dir already there
    if (err.code === 'EEXIST') return { success: true }
    throw new Error(`Gagal membuat folder "${dirPath}": ${err.message}`)
  }
}

// ─── 2. resolveDestinationPath ────────────────────────────────────────────────

/**
 * Build a safe destination path that will not overwrite an existing file.
 * If "report.pdf" already exists, tries "report_1.pdf", "report_2.pdf", etc.
 *
 * @param {string} destinationDir - Absolute path to destination folder.
 * @param {string} fileName       - The file's base name (e.g. "report.pdf").
 * @returns {string} Absolute path that is guaranteed not to conflict.
 */
function resolveDestinationPath(destinationDir, fileName) {
  const ext      = path.extname(fileName)
  const base     = path.basename(fileName, ext)
  let   candidate = path.join(destinationDir, fileName)

  if (!fs.existsSync(candidate)) return candidate

  let counter = 1
  while (true) {
    candidate = path.join(destinationDir, `${base}_${counter}${ext}`)
    if (!fs.existsSync(candidate)) return candidate
    counter++
    // Safety valve: if somehow 9999 duplicates exist, bail
    if (counter > 9999) {
      throw new Error(
        `Terlalu banyak file duplikat untuk "${fileName}" di "${destinationDir}"`
      )
    }
  }
}

// ─── Internal: low-level rename with cross-device fallback ────────────────────

/**
 * Move a file from src to dest.
 * Handles EXDEV (cross-device) by falling back to copy + unlink.
 *
 * @param {string} src  - Absolute source path.
 * @param {string} dest - Absolute destination path (must not exist).
 * @throws {Error}
 */
function _renameCrossDevice(src, dest) {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    if (err.code === 'EXDEV') {
      // Cross-device: copy first, then delete source
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    } else {
      throw err
    }
  }
}

/**
 * Retry wrapper for file operations that may fail due to locking (EBUSY / EPERM).
 * Retries up to maxRetries times with delayMs between attempts.
 *
 * @param {Function} fn        - The operation to attempt.
 * @param {string}   fileName  - Used in error messages.
 * @param {number}   maxRetries
 * @param {number}   delayMs
 */
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

// ─── 3. moveFile ─────────────────────────────────────────────────────────────

/**
 * Move a file to a destination directory according to an AutoMover rule.
 *
 * Handles:
 *  - File locking (EBUSY / EPERM): retry up to 3 times with 500ms delay
 *  - Cross-device move (EXDEV): fallback to copy + delete
 *  - Duplicate filenames: suffix _1, _2, ...
 *  - Auto folder creation when rule.autoCreateFolder is true
 *
 * @param {string} sourcePath      - Absolute path to the source file.
 * @param {string} destinationDir  - Absolute path to the destination folder.
 * @param {Object} rule            - AutoMover rule object.
 * @returns {import('./types').LogEntry} Log entry describing the operation.
 * @throws {Error} on validation failure or unrecoverable IO error.
 */
function moveFile(sourcePath, destinationDir, rule) {
  // ── Validation ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File sumber tidak ditemukan: "${sourcePath}"`)
  }

  const srcStat = fs.statSync(sourcePath)
  if (!srcStat.isFile()) {
    throw new Error(`Path sumber bukan file: "${sourcePath}"`)
  }

  if (samePath(path.dirname(sourcePath), destinationDir)) {
    throw new Error(
      `Folder sumber dan tujuan tidak boleh sama: "${destinationDir}"`
    )
  }

  // ── Ensure destination folder exists ────────────────────────────────────────
  if (!fs.existsSync(destinationDir)) {
    if (rule.autoCreateFolder) {
      createDirectoryIfNotExists(destinationDir)
    } else {
      throw new Error(
        `Folder tujuan tidak ada dan autoCreateFolder dinonaktifkan: "${destinationDir}"`
      )
    }
  }

  // ── Resolve final destination path (no overwrite) ───────────────────────────
  const fileName      = path.basename(sourcePath)
  const finalDestPath = resolveDestinationPath(destinationDir, fileName)

  // ── Execute move with retry on lock ─────────────────────────────────────────
  _withRetry(
    () => _renameCrossDevice(sourcePath, finalDestPath),
    fileName
  )

  // ── Build and return log entry ───────────────────────────────────────────────
  return {
    id:        uuidv4(),
    timestamp: new Date().toISOString(),
    ruleId:    rule.id,
    fileName,
    from:      sourcePath,
    to:        finalDestPath,
    action:    'move',
    undone:    false,
  }
}

// ─── 4. copyFile ─────────────────────────────────────────────────────────────

/**
 * Copy a file to a destination directory according to an AutoMover rule.
 * Original file is left untouched.
 *
 * @param {string} sourcePath      - Absolute path to the source file.
 * @param {string} destinationDir  - Absolute path to the destination folder.
 * @param {Object} rule            - AutoMover rule object.
 * @returns {import('./types').LogEntry} Log entry describing the operation.
 * @throws {Error} on validation failure or unrecoverable IO error.
 */
function copyFile(sourcePath, destinationDir, rule) {
  // ── Validation ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File sumber tidak ditemukan: "${sourcePath}"`)
  }

  const srcStat = fs.statSync(sourcePath)
  if (!srcStat.isFile()) {
    throw new Error(`Path sumber bukan file: "${sourcePath}"`)
  }

  if (samePath(path.dirname(sourcePath), destinationDir)) {
    throw new Error(
      `Folder sumber dan tujuan tidak boleh sama: "${destinationDir}"`
    )
  }

  // ── Ensure destination folder exists ────────────────────────────────────────
  if (!fs.existsSync(destinationDir)) {
    if (rule.autoCreateFolder) {
      createDirectoryIfNotExists(destinationDir)
    } else {
      throw new Error(
        `Folder tujuan tidak ada dan autoCreateFolder dinonaktifkan: "${destinationDir}"`
      )
    }
  }

  // ── Resolve final destination path (no overwrite) ───────────────────────────
  const fileName      = path.basename(sourcePath)
  const finalDestPath = resolveDestinationPath(destinationDir, fileName)

  // ── Execute copy with retry on lock ─────────────────────────────────────────
  _withRetry(
    () => fs.copyFileSync(sourcePath, finalDestPath, fs.constants.COPYFILE_EXCL),
    fileName
  )

  // ── Build and return log entry ───────────────────────────────────────────────
  return {
    id:        uuidv4(),
    timestamp: new Date().toISOString(),
    ruleId:    rule.id,
    fileName,
    from:      sourcePath,
    to:        finalDestPath,
    action:    'copy',
    undone:    false,
  }
}

// ─── 5. matchesRule ──────────────────────────────────────────────────────────

/**
 * Determine whether a file name satisfies an AutoMover rule's filter criteria.
 *
 * Filter logic (AND semantics when both filters are set):
 *  - extensions: case-insensitive match against file extension
 *  - namePattern: glob pattern match (supports * and ?) via micromatch or built-in fallback
 *  - Both empty → matches everything
 *  - Both set → file must satisfy BOTH conditions
 *
 * @param {string} fileName - Base name of the file (e.g. "Invoice_001.pdf").
 * @param {Object} rule     - AutoMover rule object.
 * @returns {boolean}
 */
function matchesRule(fileName, rule) {
  const filters = rule.filters || {}

  const hasExtFilter     = Array.isArray(filters.extensions) && filters.extensions.length > 0
  const hasPatternFilter = typeof filters.namePattern === 'string' && filters.namePattern.trim() !== ''

  // No filters → match everything
  if (!hasExtFilter && !hasPatternFilter) return true

  let extMatch     = true
  let patternMatch = true

  // ── Extension filter (case-insensitive) ──────────────────────────────────
  if (hasExtFilter) {
    const fileExt    = path.extname(fileName).toLowerCase()
    const normalised = filters.extensions.map(e =>
      (e.startsWith('.') ? e : `.${e}`).toLowerCase()
    )
    extMatch = normalised.includes(fileExt)
  }

  // ── Name pattern filter ───────────────────────────────────────────────────
  if (hasPatternFilter) {
    const pattern = filters.namePattern.trim()
    const mm      = getMicromatch()

    if (mm) {
      // micromatch: case-insensitive, match against base name
      patternMatch = mm.isMatch(fileName.toLowerCase(), pattern.toLowerCase(), {
        nocase:  true,
        dot:     true,   // allow matching dotfiles
        windows: true,   // normalise Windows paths
      })
    } else {
      // Built-in fallback: convert glob to RegExp (supports * and ?)
      patternMatch = _globMatch(fileName, pattern)
    }
  }

  return extMatch && patternMatch
}

/**
 * Lightweight glob matcher (fallback when micromatch is unavailable).
 * Supports * (any sequence except path separator) and ? (single char).
 * Case-insensitive.
 *
 * @param {string} fileName
 * @param {string} pattern
 * @returns {boolean}
 */
function _globMatch(fileName, pattern) {
  // Escape all regex special chars except * and ?
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex metacharacters
    .replace(/\*/g, '.*')                    // * → any characters
    .replace(/\?/g, '.')                     // ? → single character

  const regex = new RegExp(`^${escaped}$`, 'i')
  return regex.test(fileName)
}

// ─── 6. scanAndSort ──────────────────────────────────────────────────────────

/**
 * Scan a directory and apply all active rules to every file found.
 * Only scans the top-level directory (non-recursive).
 *
 * Error isolation: if processing one file fails, the error is collected
 * and processing continues with the next file/rule.
 *
 * @param {string}   sourceDirectory - Absolute path to the folder to scan.
 * @param {Object[]} rules           - Array of AutoMover rule objects.
 * @returns {{ success: LogEntry[], errors: { fileName: string, ruleId: string, error: string }[] }}
 */
function scanAndSort(sourceDirectory, rules) {
  const result = { success: [], errors: [] }

  // ── Validate source directory ────────────────────────────────────────────
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Folder sumber tidak ditemukan: "${sourceDirectory}"`)
  }

  const dirStat = fs.statSync(sourceDirectory)
  if (!dirStat.isDirectory()) {
    throw new Error(`Path bukan folder: "${sourceDirectory}"`)
  }

  // ── Read directory contents (non-recursive) ──────────────────────────────
  let entries
  try {
    entries = fs.readdirSync(sourceDirectory, { withFileTypes: true })
  } catch (err) {
    throw new Error(`Tidak bisa membaca folder "${sourceDirectory}": ${err.message}`)
  }

  const files     = entries.filter(e => e.isFile())
  const activeRules = (rules || []).filter(r => r.isActive === true)

  if (activeRules.length === 0 || files.length === 0) {
    return result
  }

  // ── Process each file against each active rule ────────────────────────────
  for (const fileEntry of files) {
    const fileName   = fileEntry.name
    const sourcePath = path.join(sourceDirectory, fileName)

    for (const rule of activeRules) {
      // Skip if this rule's watchFolder doesn't match the scan directory
      if (rule.watchFolder && !samePath(rule.watchFolder, sourceDirectory)) {
        continue
      }

      if (!matchesRule(fileName, rule)) continue

      try {
        let logEntry
        if (rule.action === 'copy') {
          logEntry = copyFile(sourcePath, rule.destination, rule)
        } else {
          logEntry = moveFile(sourcePath, rule.destination, rule)
        }
        result.success.push(logEntry)

        // After a successful move, the file no longer exists — stop checking
        // other rules for it (avoids error on the next rule trying to read it)
        if (rule.action === 'move') break

      } catch (err) {
        result.errors.push({
          fileName,
          ruleId: rule.id,
          error:  err.message,
        })
        // If the file is gone (already moved by previous rule or external process),
        // no point trying further rules
        if (!fs.existsSync(sourcePath)) break
      }
    }
  }

  return result
}

// ─── 7. undoAction ──────────────────────────────────────────────────────────

/**
 * Reverse a previously logged file operation.
 *
 * - For "move": rename file from logEntry.to back to logEntry.from
 * - For "copy": delete the copy at logEntry.to (original is still at logEntry.from)
 *
 * @param {Object} logEntry - A LogEntry object (from the activity log).
 * @returns {{ success: true, updatedLog: LogEntry }}
 * @throws {Error} if the operation cannot be undone (already undone, file missing, etc.)
 */
function undoAction(logEntry) {
  // ── Guard: already undone ──────────────────────────────────────────────────
  if (logEntry.undone === true) {
    throw new Error(`Operasi ini sudah dibatalkan sebelumnya: "${logEntry.fileName}"`)
  }

  // ── Guard: file at destination must still exist ───────────────────────────
  if (!fs.existsSync(logEntry.to)) {
    throw new Error(
      `File tidak ditemukan di lokasi tujuan — mungkin sudah dihapus atau dipindahkan manual: "${logEntry.to}"`
    )
  }

  if (logEntry.action === 'copy') {
    // Undo copy → delete the copy
    try {
      fs.unlinkSync(logEntry.to)
    } catch (err) {
      throw new Error(
        `Gagal menghapus salinan file "${logEntry.to}": ${err.message}`
      )
    }
  } else {
    // Undo move → move back from logEntry.to to logEntry.from
    // Ensure parent directory of original location still exists
    const originalDir = path.dirname(logEntry.from)
    if (!fs.existsSync(originalDir)) {
      try {
        fs.mkdirSync(originalDir, { recursive: true })
      } catch (err) {
        throw new Error(
          `Tidak bisa membuat ulang folder asal "${originalDir}": ${err.message}`
        )
      }
    }

    // Check for conflict at original location
    if (fs.existsSync(logEntry.from)) {
      throw new Error(
        `File sudah ada di lokasi asal — tidak bisa dikembalikan tanpa menimpa: "${logEntry.from}"`
      )
    }

    try {
      _renameCrossDevice(logEntry.to, logEntry.from)
    } catch (err) {
      throw new Error(
        `Gagal mengembalikan file "${logEntry.fileName}" ke lokasi asal: ${err.message}`
      )
    }
  }

  const updatedLog = { ...logEntry, undone: true }
  return { success: true, updatedLog }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  createDirectoryIfNotExists,
  resolveDestinationPath,
  moveFile,
  copyFile,
  matchesRule,
  scanAndSort,
  undoAction,
}

// =============================================================================
// MANUAL TEST CASES
// =============================================================================
//
// Cara run: node src/main/fileOps.js
// (Uncomment blok TEST di bawah ini, jalankan, lalu comment kembali)
//
// Sebelum test: pastikan struktur berikut ada di sistem kamu:
//   /tmp/automover_test/source/
//     report.pdf
//     invoice_001.pdf
//     photo.png
//     locked_file.docx   ← (buka di Word untuk simulasi lock)
//   /tmp/automover_test/dest/
//     report.pdf         ← (untuk test duplikat)
//
// -----------------------------------------------------------------------------
// const os   = require('os')
// const TEST = path.join(os.tmpdir(), 'automover_test')
//
// // Setup test fixtures
// function setup() {
//   fs.mkdirSync(path.join(TEST, 'source'), { recursive: true })
//   fs.mkdirSync(path.join(TEST, 'dest'),   { recursive: true })
//   fs.writeFileSync(path.join(TEST, 'source', 'report.pdf'),      'PDF content')
//   fs.writeFileSync(path.join(TEST, 'source', 'invoice_001.pdf'), 'Invoice')
//   fs.writeFileSync(path.join(TEST, 'source', 'photo.png'),       'PNG data')
//   fs.writeFileSync(path.join(TEST, 'source', 'doc.docx'),        'Word doc')
//   fs.writeFileSync(path.join(TEST, 'dest',   'report.pdf'),      'Existing PDF')
//   console.log('✅ Test fixtures created in', TEST)
// }
//
// function runTests() {
//   setup()
//   let passed = 0; let failed = 0
//
//   function assert(name, fn) {
//     try { fn(); console.log(`  ✅ PASS: ${name}`); passed++ }
//     catch (e) { console.error(`  ❌ FAIL: ${name}\n     ${e.message}`); failed++ }
//   }
//
//   const dummyRule = {
//     id: 'test-rule-1', watchFolder: path.join(TEST, 'source'),
//     filters: { extensions: [], namePattern: '' },
//     action: 'move', destination: path.join(TEST, 'dest'),
//     autoCreateFolder: true, isActive: true,
//   }
//
//   // ── TEST 1: createDirectoryIfNotExists ──────────────────────────────────
//   console.log('\n[1] createDirectoryIfNotExists')
//   assert('creates nested dirs', () => {
//     const p = path.join(TEST, 'new/nested/dir')
//     createDirectoryIfNotExists(p)
//     if (!fs.existsSync(p)) throw new Error('Dir not created')
//   })
//   assert('does not throw if already exists', () => {
//     createDirectoryIfNotExists(path.join(TEST, 'dest'))
//   })
//
//   // ── TEST 2: resolveDestinationPath ─────────────────────────────────────
//   console.log('\n[2] resolveDestinationPath')
//   assert('returns original path if no conflict', () => {
//     const r = resolveDestinationPath(path.join(TEST, 'dest'), 'unique_123.pdf')
//     if (!r.endsWith('unique_123.pdf')) throw new Error(`Got: ${r}`)
//   })
//   assert('returns _1 suffix when original exists', () => {
//     const r = resolveDestinationPath(path.join(TEST, 'dest'), 'report.pdf')
//     if (!r.endsWith('report_1.pdf')) throw new Error(`Got: ${r}`)
//   })
//
//   // ── TEST 3: matchesRule ────────────────────────────────────────────────
//   console.log('\n[3] matchesRule')
//   assert('empty filters = match all', () => {
//     if (!matchesRule('anything.xyz', dummyRule)) throw new Error()
//   })
//   assert('extension filter: .pdf matches', () => {
//     const r = { ...dummyRule, filters: { extensions: ['.pdf'], namePattern: '' } }
//     if (!matchesRule('report.pdf', r)) throw new Error()
//   })
//   assert('extension filter: case-insensitive (.PDF)', () => {
//     const r = { ...dummyRule, filters: { extensions: ['.pdf'], namePattern: '' } }
//     if (!matchesRule('REPORT.PDF', r)) throw new Error()
//   })
//   assert('extension filter: .png does NOT match .pdf rule', () => {
//     const r = { ...dummyRule, filters: { extensions: ['.pdf'], namePattern: '' } }
//     if (matchesRule('photo.png', r)) throw new Error()
//   })
//   assert('namePattern: Invoice_* matches invoice_001.pdf', () => {
//     const r = { ...dummyRule, filters: { extensions: [], namePattern: 'invoice_*' } }
//     if (!matchesRule('invoice_001.pdf', r)) throw new Error()
//   })
//   assert('namePattern: wildcard ? matches single char', () => {
//     const r = { ...dummyRule, filters: { extensions: [], namePattern: 'file?.pdf' } }
//     if (!matchesRule('fileA.pdf', r)) throw new Error()
//   })
//   assert('AND logic: must match both ext AND pattern', () => {
//     const r = { ...dummyRule, filters: { extensions: ['.pdf'], namePattern: 'invoice_*' } }
//     if (matchesRule('photo.png',      r)) throw new Error('png should not match')
//     if (matchesRule('invoice_001.png',r)) throw new Error('png should not match')
//     if (!matchesRule('invoice_001.pdf',r)) throw new Error('should match')
//   })
//
//   // ── TEST 4: moveFile ───────────────────────────────────────────────────
//   console.log('\n[4] moveFile')
//   assert('moves file and returns log entry', () => {
//     const src  = path.join(TEST, 'source', 'doc.docx')
//     const dest = path.join(TEST, 'dest')
//     fs.writeFileSync(src, 'docx') // re-create in case previous test moved it
//     const log = moveFile(src, dest, dummyRule)
//     if (!fs.existsSync(log.to))  throw new Error('File not at destination')
//     if (fs.existsSync(src))      throw new Error('File still at source')
//     if (log.action !== 'move')   throw new Error('Wrong action in log')
//   })
//   assert('duplicate: adds _1 suffix', () => {
//     // report.pdf already exists in dest
//     fs.writeFileSync(path.join(TEST, 'source', 'report.pdf'), 'new content')
//     const log = moveFile(path.join(TEST, 'source', 'report.pdf'), path.join(TEST, 'dest'), dummyRule)
//     if (!log.to.endsWith('report_1.pdf')) throw new Error(`Expected _1 suffix, got: ${log.to}`)
//   })
//   assert('throws when source === destination folder', () => {
//     fs.writeFileSync(path.join(TEST, 'source', 'test.txt'), 'x')
//     try {
//       moveFile(path.join(TEST, 'source', 'test.txt'), path.join(TEST, 'source'), dummyRule)
//       throw new Error('Should have thrown')
//     } catch (e) { if (e.message.includes('Should have')) throw e }
//   })
//
//   // ── TEST 5: copyFile ───────────────────────────────────────────────────
//   console.log('\n[5] copyFile')
//   assert('copies file, original remains', () => {
//     const src  = path.join(TEST, 'source', 'photo.png')
//     if (!fs.existsSync(src)) fs.writeFileSync(src, 'png')
//     const log = copyFile(src, path.join(TEST, 'dest'), dummyRule)
//     if (!fs.existsSync(log.to)) throw new Error('Copy not at dest')
//     if (!fs.existsSync(src))    throw new Error('Original missing after copy')
//     if (log.action !== 'copy')  throw new Error('Wrong action in log')
//   })
//
//   // ── TEST 6: undoAction ─────────────────────────────────────────────────
//   console.log('\n[6] undoAction')
//   assert('undo move returns file to source', () => {
//     const src  = path.join(TEST, 'source', 'undo_test.txt')
//     fs.writeFileSync(src, 'undo content')
//     const log  = moveFile(src, path.join(TEST, 'dest'), dummyRule)
//     const res  = undoAction(log)
//     if (!fs.existsSync(log.from)) throw new Error('File not back at source')
//     if (fs.existsSync(log.to))    throw new Error('File still at dest after undo')
//     if (!res.updatedLog.undone)   throw new Error('undone flag not set')
//   })
//   assert('undo copy deletes the copy', () => {
//     const src  = path.join(TEST, 'source', 'undo_copy.txt')
//     fs.writeFileSync(src, 'copy content')
//     const copyRule = { ...dummyRule, action: 'copy' }
//     const log  = copyFile(src, path.join(TEST, 'dest'), copyRule)
//     undoAction(log)
//     if (fs.existsSync(log.to)) throw new Error('Copy still exists after undo')
//     if (!fs.existsSync(src))   throw new Error('Original should still exist')
//   })
//   assert('throws when already undone', () => {
//     const src  = path.join(TEST, 'source', 'undo2.txt')
//     fs.writeFileSync(src, 'x')
//     const log  = moveFile(src, path.join(TEST, 'dest'), dummyRule)
//     const res  = undoAction(log)
//     try { undoAction(res.updatedLog); throw new Error('Should have thrown') }
//     catch (e) { if (e.message.includes('Should have')) throw e }
//   })
//   assert('throws when destination file is missing', () => {
//     const fakeLog = { id: 'x', fileName: 'ghost.pdf', from: '/tmp/x.pdf',
//       to: '/tmp/nonexistent/ghost.pdf', action: 'move', undone: false }
//     try { undoAction(fakeLog); throw new Error('Should have thrown') }
//     catch (e) { if (e.message.includes('Should have')) throw e }
//   })
//
//   // ── TEST 7: scanAndSort ────────────────────────────────────────────────
//   console.log('\n[7] scanAndSort')
//   assert('processes all matching files', () => {
//     const srcDir  = path.join(TEST, 'scan_src')
//     const destDir = path.join(TEST, 'scan_dest')
//     fs.mkdirSync(srcDir,  { recursive: true })
//     fs.mkdirSync(destDir, { recursive: true })
//     fs.writeFileSync(path.join(srcDir, 'a.pdf'), 'a')
//     fs.writeFileSync(path.join(srcDir, 'b.pdf'), 'b')
//     fs.writeFileSync(path.join(srcDir, 'c.png'), 'c') // should not match
//     const scanRule = { ...dummyRule,
//       watchFolder: srcDir, destination: destDir,
//       filters: { extensions: ['.pdf'], namePattern: '' },
//     }
//     const res = scanAndSort(srcDir, [scanRule])
//     if (res.success.length !== 2) throw new Error(`Expected 2 moved, got ${res.success.length}`)
//     if (res.errors.length  !== 0) throw new Error(`Unexpected errors: ${JSON.stringify(res.errors)}`)
//     if (!fs.existsSync(path.join(srcDir, 'c.png'))) throw new Error('PNG should remain')
//   })
//
//   // ── Summary ────────────────────────────────────────────────────────────
//   console.log(`\n${'─'.repeat(40)}`)
//   console.log(`Result: ${passed} passed, ${failed} failed`)
//   process.exitCode = failed > 0 ? 1 : 0
// }
//
// if (require.main === module) runTests()
// =============================================================================