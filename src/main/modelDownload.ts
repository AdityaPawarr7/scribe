import { createWriteStream, mkdirSync, renameSync, rmSync } from 'fs'
import { dirname } from 'path'
import { get } from 'https'
import type { IncomingMessage } from 'http'
import { defaultModelPath } from './settings'
import type { ModelDownloadProgress } from '@shared/types'

const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'

function fetchFollowingRedirects(url: string, depth = 0): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Too many redirects'))
    get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        resolve(fetchFollowingRedirects(res.headers.location, depth + 1))
      } else if (res.statusCode === 200) {
        resolve(res)
      } else {
        res.resume()
        reject(new Error(`Download failed with HTTP ${res.statusCode}`))
      }
    }).on('error', reject)
  })
}

export async function downloadModel(
  onProgress: (progress: ModelDownloadProgress) => void
): Promise<void> {
  const target = defaultModelPath()
  const partial = `${target}.part`
  mkdirSync(dirname(target), { recursive: true })

  try {
    const response = await fetchFollowingRedirects(MODEL_URL)
    const totalBytes = Number(response.headers['content-length'] ?? 0)
    let receivedBytes = 0
    let lastReport = 0

    await new Promise<void>((resolve, reject) => {
      const file = createWriteStream(partial)
      response.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length
        // throttle progress events to ~every 2MB
        if (receivedBytes - lastReport > 2 * 1024 * 1024) {
          lastReport = receivedBytes
          onProgress({ receivedBytes, totalBytes, done: false })
        }
      })
      response.pipe(file)
      file.on('finish', () => resolve())
      file.on('error', reject)
      response.on('error', reject)
    })

    renameSync(partial, target)
    onProgress({ receivedBytes, totalBytes, done: true })
  } catch (error) {
    rmSync(partial, { force: true })
    const message = error instanceof Error ? error.message : String(error)
    onProgress({ receivedBytes: 0, totalBytes: 0, done: true, error: message })
    throw error
  }
}
