import { buildExtractionUserPrompt, EXTRACTION_SYSTEM_PROMPT } from './prompts'

export const DEFAULT_CLOUDFLARE_MODEL = '@cf/meta/llama-3.1-8b-instruct'

export class CloudflareConfigError extends Error {
  constructor(message = 'Cloudflare Workers AI credentials are not configured.') {
    super(message)
    this.name = 'CloudflareConfigError'
  }
}

export class CloudflareRateLimitError extends Error {
  constructor(message = 'Cloudflare Workers AI rate limit exceeded. Please try again shortly.') {
    super(message)
    this.name = 'CloudflareRateLimitError'
  }
}

export class CloudflareApiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'CloudflareApiError'
    this.status = status
  }
}

export async function runCloudflarePrompt(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
): Promise<string> {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || process.env.NEXT_CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.NEXT_CLOUDFLARE_API_TOKEN?.trim()
  const model =
    process.env.CLOUDFLARE_AI_MODEL?.trim() ||
    process.env.NEXT_CLOUDFLARE_AI_MODEL?.trim() ||
    DEFAULT_CLOUDFLARE_MODEL

  if (!accountId || !apiToken) {
    throw new CloudflareConfigError(
      'Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN on the server.',
    )
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.15,
      max_tokens: maxTokens,
    }),
    cache: 'no-store',
  })

  if (response.status === 429) {
    throw new CloudflareRateLimitError()
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new CloudflareApiError(
      `Cloudflare Workers AI request failed (${response.status}): ${text.slice(0, 200)}`,
      response.status,
    )
  }

  const json = (await response.json()) as {
    success?: boolean
    result?: {
      response?: unknown
      choices?: Array<{ message?: { content?: unknown } }>
    }
    errors?: Array<{ message?: string }>
  }

  if (json.success === false) {
    const errMsg = json.errors?.[0]?.message ?? 'Cloudflare Workers AI returned an error.'
    throw new CloudflareApiError(errMsg, 502)
  }

  const rawResponse = json.result?.response
  if (typeof rawResponse === 'string' && rawResponse.trim()) {
    return rawResponse
  }
  if (rawResponse && typeof rawResponse === 'object') {
    return JSON.stringify(rawResponse)
  }

  const choiceContent = json.result?.choices?.[0]?.message?.content
  if (typeof choiceContent === 'string' && choiceContent.trim()) {
    return choiceContent
  }

  throw new CloudflareApiError('Cloudflare Workers AI returned an empty response.', 502)
}

export async function runCloudflareJobExtraction(content: string): Promise<string> {
  return runCloudflarePrompt(EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt(content), 4096)
}
