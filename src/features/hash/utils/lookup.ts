export type HashLookupAlgorithm =
  | 'md5'
  | 'sha1'
  | 'sha224'
  | 'sha256'
  | 'sha384'
  | 'sha512'
  | 'ripemd160'
  | 'sha3_224'
  | 'sha3_256'
  | 'sha3_384'
  | 'sha3_512'

export async function lookupHash(algorithm: HashLookupAlgorithm, hash: string) {
  try {
    const response = await fetch('/api/hash-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ algorithm, hash })
    })

    if (!response.ok) return null

    const payload = (await response.json()) as { found?: boolean; plaintext?: unknown }
    return payload.found && typeof payload.plaintext === 'string' ? payload.plaintext : null
  } catch {
    return null
  }
}
