'use strict'

const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

function ensureDir(dirPath) {
  if (!dirPath) throw new Error('Destination folder is empty')
  fs.mkdirSync(dirPath, { recursive: true })
}

function crossDeviceMove(sourcePath, destinationPath) {
  try {
    fs.renameSync(sourcePath, destinationPath)
  } catch (err) {
    if (err.code !== 'EXDEV') throw err
    fs.copyFileSync(sourcePath, destinationPath)
    fs.unlinkSync(sourcePath)
  }
}

function validatePreviewItem(item) {
  if (!item || typeof item !== 'object') throw new Error('Invalid preview item')
  if (!item.sourcePath) throw new Error('Missing source path')
  if (!item.destinationPath) throw new Error('Missing destination path')
  if (!item.fileName) throw new Error('Missing file name')
}

function buildLog(item, action, extra = {}) {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ruleId: item.ruleId || '',
    priority: item.priority,
    fileName: item.fileName,
    from: item.sourcePath,
    to: item.destinationPath,
    action,
    undone: false,
    conflict: Boolean(item.conflict),
    renamed: Boolean(item.renamed),
    skipped: action === 'skip' || Boolean(item.skipped),
    overwritten: Boolean(item.overwritten),
    duplicate: Boolean(item.duplicate),
    ...extra,
  }
}

function executeOne(item) {
  validatePreviewItem(item)

  if (item.status === 'skipped' || item.skipped) {
    return { type: 'skipped', log: buildLog(item, 'skip') }
  }

  if (item.status !== 'planned') {
    return { type: 'error', error: { fileName: item.fileName, sourcePath: item.sourcePath, error: `Preview item status is ${item.status}` } }
  }

  if (!fs.existsSync(item.sourcePath)) {
    return { type: 'error', error: { fileName: item.fileName, sourcePath: item.sourcePath, error: 'Source file no longer exists' } }
  }

  const stat = fs.statSync(item.sourcePath)
  if (!stat.isFile()) {
    return { type: 'error', error: { fileName: item.fileName, sourcePath: item.sourcePath, error: 'Source path is not a file' } }
  }

  const destinationDir = item.destinationFolder || path.dirname(item.destinationPath)
  ensureDir(destinationDir)

  if (fs.existsSync(item.destinationPath)) {
    if (!item.overwritten) {
      return { type: 'error', error: { fileName: item.fileName, sourcePath: item.sourcePath, destinationPath: item.destinationPath, error: 'Destination already exists. Run Preview again.' } }
    }
    fs.unlinkSync(item.destinationPath)
  }

  if (item.action === 'copy') {
    fs.copyFileSync(item.sourcePath, item.destinationPath, fs.constants.COPYFILE_EXCL)
    return { type: 'success', log: buildLog(item, 'copy') }
  }

  crossDeviceMove(item.sourcePath, item.destinationPath)
  return { type: 'success', log: buildLog(item, 'move') }
}

function executePreviewItems(items) {
  const result = { success: [], skipped: [], errors: [] }
  const safeItems = Array.isArray(items) ? items : []

  for (const item of safeItems) {
    try {
      const outcome = executeOne(item)
      if (outcome.type === 'success') result.success.push(outcome.log)
      else if (outcome.type === 'skipped') result.skipped.push(outcome.log)
      else result.errors.push(outcome.error)
    } catch (err) {
      result.errors.push({ fileName: item?.fileName, sourcePath: item?.sourcePath, destinationPath: item?.destinationPath, error: err.message })
    }
  }

  return result
}

module.exports = { executePreviewItems }
