import { callAI } from '@/lib/ai'
import type {
  ArtifactType,
  QuizResult,
  FlashcardsResult,
  MindMapResult,
  SlideResult,
  AudioOptions,
  QuizOptions,
  SlideOptions,
} from '@/types/notebooklm'
import {
  buildQuizPrompt,
  buildFlashcardsPrompt,
  buildMindMapPrompt,
  buildSlidesPrompt,
  buildAudioScriptPrompt,
} from './prompts'

function parseJsonFromResponse(raw: string): unknown {
  // Strip markdown fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const jsonStr = fenceMatch ? fenceMatch[1] : raw

  // Try parsing directly
  try {
    return JSON.parse(jsonStr)
  } catch {
    // Try finding the first { ... } or [ ... ] block
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (objectMatch) return JSON.parse(objectMatch[0])
    throw new Error('Failed to parse JSON from AI response')
  }
}

export async function generateQuiz(markdown: string, options?: QuizOptions): Promise<QuizResult> {
  const prompt = buildQuizPrompt(markdown, options)
  const raw = await callAI(prompt, { model: 'general', temperature: 0.5, maxTokens: 4096 })
  const parsed = parseJsonFromResponse(raw) as QuizResult

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Invalid quiz result: no questions')
  }

  return parsed
}

export async function generateFlashcards(markdown: string): Promise<FlashcardsResult> {
  const prompt = buildFlashcardsPrompt(markdown)
  const raw = await callAI(prompt, { model: 'general', temperature: 0.5, maxTokens: 4096 })
  const parsed = parseJsonFromResponse(raw) as FlashcardsResult

  if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
    throw new Error('Invalid flashcards result: no cards')
  }

  return parsed
}

export async function generateMindMap(markdown: string): Promise<MindMapResult> {
  const prompt = buildMindMapPrompt(markdown)
  const raw = await callAI(prompt, { model: 'general', temperature: 0.3, maxTokens: 4096 })
  const parsed = parseJsonFromResponse(raw) as MindMapResult

  if (!parsed.root || !parsed.root.label) {
    throw new Error('Invalid mind map result: no root node')
  }

  return parsed
}

export async function generateSlides(markdown: string, options?: SlideOptions): Promise<SlideResult> {
  const prompt = buildSlidesPrompt(markdown, options)
  const raw = await callAI(prompt, { model: 'general', temperature: 0.5, maxTokens: 4096 })
  const parsed = parseJsonFromResponse(raw) as SlideResult

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error('Invalid slides result: no slides')
  }

  return parsed
}

export async function generateAudioScript(markdown: string, options?: AudioOptions): Promise<string> {
  const prompt = buildAudioScriptPrompt(markdown, options)
  return callAI(prompt, { model: 'general', temperature: 0.7, maxTokens: 4096 })
}

export interface GenerateContentResult {
  readonly data?: unknown
  readonly audioBuffer?: Buffer
  readonly audioScript?: string
}

export async function generateContent(
  markdown: string,
  type: ArtifactType,
  options: Record<string, unknown>,
): Promise<GenerateContentResult> {
  switch (type) {
    case 'quiz':
      return { data: await generateQuiz(markdown, options as QuizOptions) }
    case 'flashcards':
      return { data: await generateFlashcards(markdown) }
    case 'mind-map':
      return { data: await generateMindMap(markdown) }
    case 'slide-deck':
      return { data: await generateSlides(markdown, options as SlideOptions) }
    case 'audio': {
      const script = await generateAudioScript(markdown, options as AudioOptions)
      const audioBuffer = await generateTTS(script)
      return { audioBuffer, audioScript: script }
    }
    default:
      throw new Error(`Unsupported content type: ${type}`)
  }
}

async function generateTTS(script: string): Promise<Buffer> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Split into chunks if too long (TTS has ~4096 char limit per call)
  const MAX_CHUNK = 4000
  const chunks: string[] = []
  let remaining = script

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) {
      chunks.push(remaining)
      break
    }
    // Split at sentence boundary
    const cutPoint = remaining.lastIndexOf('.', MAX_CHUNK)
    const splitAt = cutPoint > MAX_CHUNK * 0.5 ? cutPoint + 1 : MAX_CHUNK
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  const buffers: Buffer[] = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await client.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: chunk,
        response_format: 'mp3',
      })
      return Buffer.from(await response.arrayBuffer())
    })
  )

  // Concatenate MP3 buffers (MP3 is frame-based, concat is safe)
  return Buffer.concat(buffers)
}
