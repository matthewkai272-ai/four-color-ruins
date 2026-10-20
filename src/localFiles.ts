export type LocalFileResult = 'file' | 'download'

interface LocalWritableFile {
  write(data: string): Promise<void>
  close(): Promise<void>
}

interface LocalFileHandle {
  createWritable(): Promise<LocalWritableFile>
  getFile(): Promise<File>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: unknown) => Promise<LocalFileHandle>
    showOpenFilePicker?: (options?: unknown) => Promise<LocalFileHandle[]>
  }
}

const fileTypes = [{ description: 'JSON 配置文件', accept: { 'application/json': ['.json'] } }]

export async function saveJsonFile(filename: string, value: unknown): Promise<LocalFileResult> {
  const content = JSON.stringify(value, null, 2)
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({ suggestedName: filename, types: fileTypes })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    return 'file'
  }
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'download'
}

export async function openJsonFile(): Promise<unknown> {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({ multiple: false, types: fileTypes })
    if (!handle) throw new Error('没有选择配置文件。')
    return JSON.parse(await (await handle.getFile()).text())
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('没有选择配置文件。'))
      try { resolve(JSON.parse(await file.text())) } catch { reject(new Error('配置文件不是有效的 JSON。')) }
    }
    input.click()
  })
}
