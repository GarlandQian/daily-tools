import { NextResponse } from 'next/server'

const SUPPORTED_ALGORITHMS = {
  md5: 32,
  sha1: 40,
  sha224: 56,
  sha256: 64,
  sha384: 96,
  sha512: 128,
  ripemd160: 40,
  sha3_224: 56,
  sha3_256: 64,
  sha3_384: 96,
  sha3_512: 128
} as const

const CRACK_CRYPT_ALGORITHMS = new Set(['md5', 'sha1', 'sha256', 'sha512'])

type SupportedAlgorithm = keyof typeof SUPPORTED_ALGORITHMS

const isSupportedAlgorithm = (value: unknown): value is SupportedAlgorithm =>
  typeof value === 'string' && value in SUPPORTED_ALGORITHMS

const withTimeout = (timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return { controller, clear: () => clearTimeout(timeout) }
}

const lookupWithCrackCrypt = async (hash: string, algorithm: SupportedAlgorithm) => {
  if (!CRACK_CRYPT_ALGORITHMS.has(algorithm)) return null

  const { controller, clear } = withTimeout(3500)
  try {
    const response = await fetch('https://crackcrypt.com/api/v1/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'daily-tools-hash-lookup/1.0'
      },
      body: JSON.stringify({ hash, alg: algorithm }),
      signal: controller.signal
    })

    if (!response.ok) return null

    const payload = (await response.json()) as { found?: boolean; plaintext?: unknown }
    return payload.found && typeof payload.plaintext === 'string' ? payload.plaintext : null
  } catch {
    return null
  } finally {
    clear()
  }
}

const lookupWithHashDecrypt = async (hash: string, algorithm: SupportedAlgorithm) => {
  const { controller, clear } = withTimeout(3500)
  try {
    const response = await fetch(`https://api.hash-decrypt.io/v1/${algorithm}/${hash}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9',
        'User-Agent': 'daily-tools-hash-lookup/1.0'
      },
      signal: controller.signal
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        found?: boolean
        password?: unknown
        plaintext?: unknown
        result?: unknown
        value?: unknown
      }
      const plaintext = payload.plaintext ?? payload.password ?? payload.result ?? payload.value
      return payload.found !== false && typeof plaintext === 'string' && plaintext
        ? plaintext
        : null
    }

    const text = (await response.text()).trim()
    if (!text || text.toLowerCase() === 'not found' || text.toLowerCase() === 'false') {
      return null
    }
    return text
  } catch {
    return null
  } finally {
    clear()
  }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ found: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { hash, algorithm } = payload as { hash?: unknown; algorithm?: unknown }

  if (!isSupportedAlgorithm(algorithm) || typeof hash !== 'string') {
    return NextResponse.json({ found: false, error: 'Unsupported hash lookup' }, { status: 400 })
  }

  const normalizedHash = hash.trim().toLowerCase()
  const expectedLength = SUPPORTED_ALGORITHMS[algorithm]

  if (normalizedHash.length !== expectedLength || !/^[a-f0-9]+$/.test(normalizedHash)) {
    return NextResponse.json({ found: false, error: 'Invalid hash format' }, { status: 400 })
  }

  const plaintext =
    (await lookupWithCrackCrypt(normalizedHash, algorithm)) ??
    (await lookupWithHashDecrypt(normalizedHash, algorithm))

  return NextResponse.json(
    plaintext
      ? { found: true, plaintext, algorithm }
      : { found: false, plaintext: null, algorithm },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}
