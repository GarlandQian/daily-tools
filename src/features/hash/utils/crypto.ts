type CryptoJSModule = typeof import('crypto-js')
type CryptoJSImport = CryptoJSModule & { default?: CryptoJSModule }
type CryptoWordArray = ReturnType<CryptoJSModule['MD5']>

export type TextHashAlgorithm =
  | 'MD5'
  | 'RIPEMD160'
  | 'SHA1'
  | 'SHA224'
  | 'SHA256'
  | 'SHA3'
  | 'SHA384'
  | 'SHA512'

export type HmacAlgorithm =
  | 'HmacMD5'
  | 'HmacRIPEMD160'
  | 'HmacSHA1'
  | 'HmacSHA224'
  | 'HmacSHA256'
  | 'HmacSHA3'
  | 'HmacSHA384'
  | 'HmacSHA512'

export type DerivedLength = 16 | 24 | 32 | 48 | 64
export type PrfAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'

export interface DerivedOutput {
  base64: string
  hex: string
  json: string
}

let cryptoPromise: Promise<CryptoJSModule> | null = null

export const loadCryptoJS = () => {
  cryptoPromise ??= import('crypto-js').then(module => {
    const loaded = module as CryptoJSImport
    return loaded.default ?? loaded
  })

  return cryptoPromise
}

export const calculateTextHash = (
  cryptoJS: CryptoJSModule,
  algorithm: TextHashAlgorithm,
  message: string
) => {
  switch (algorithm) {
    case 'MD5':
      return cryptoJS.MD5(message).toString()
    case 'RIPEMD160':
      return cryptoJS.RIPEMD160(message).toString()
    case 'SHA1':
      return cryptoJS.SHA1(message).toString()
    case 'SHA224':
      return cryptoJS.SHA224(message).toString()
    case 'SHA256':
      return cryptoJS.SHA256(message).toString()
    case 'SHA3':
      return cryptoJS.SHA3(message).toString()
    case 'SHA384':
      return cryptoJS.SHA384(message).toString()
    case 'SHA512':
      return cryptoJS.SHA512(message).toString()
  }
}

export const calculateHmac = (
  cryptoJS: CryptoJSModule,
  algorithm: HmacAlgorithm,
  message: string,
  key: string
) => {
  switch (algorithm) {
    case 'HmacMD5':
      return cryptoJS.HmacMD5(message, key).toString()
    case 'HmacRIPEMD160':
      return cryptoJS.HmacRIPEMD160(message, key).toString()
    case 'HmacSHA1':
      return cryptoJS.HmacSHA1(message, key).toString()
    case 'HmacSHA224':
      return cryptoJS.HmacSHA224(message, key).toString()
    case 'HmacSHA256':
      return cryptoJS.HmacSHA256(message, key).toString()
    case 'HmacSHA3':
      return cryptoJS.HmacSHA3(message, key).toString()
    case 'HmacSHA384':
      return cryptoJS.HmacSHA384(message, key).toString()
    case 'HmacSHA512':
      return cryptoJS.HmacSHA512(message, key).toString()
  }
}

const bytesToWords = (bytes: number) => bytes / 4

const getPrfHasher = (cryptoJS: CryptoJSModule, prf: PrfAlgorithm) => {
  switch (prf) {
    case 'SHA1':
      return cryptoJS.algo.SHA1
    case 'SHA256':
      return cryptoJS.algo.SHA256
    case 'SHA512':
      return cryptoJS.algo.SHA512
  }
}

export const derivePBKDFKey = (
  cryptoJS: CryptoJSModule,
  password: string,
  salt: string,
  length: DerivedLength,
  iterations: number,
  prf: PrfAlgorithm
) =>
  cryptoJS.PBKDF2(password, salt, {
    hasher: getPrfHasher(cryptoJS, prf),
    iterations,
    keySize: bytesToWords(length)
  })

export const buildPBKDFOutput = (
  cryptoJS: CryptoJSModule,
  password: string,
  salt: string,
  length: DerivedLength,
  iterations: number,
  prf: PrfAlgorithm
): DerivedOutput | null => {
  if (!password.trim() || !salt.trim()) return null

  const wordArray = derivePBKDFKey(cryptoJS, password, salt, length, iterations, prf)
  const hex = wordArray.toString(cryptoJS.enc.Hex)
  const base64 = wordArray.toString(cryptoJS.enc.Base64)

  return {
    base64,
    hex,
    json: JSON.stringify(
      {
        algorithm: 'PBKDF2',
        prf,
        iterations,
        salt,
        lengthBytes: length,
        hex,
        base64
      },
      null,
      2
    )
  }
}

export const arrayBufferToWordArray = (cryptoJS: CryptoJSModule, buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  const words: number[] = []

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >>> 2] |= bytes[index] << (24 - (index % 4) * 8)
  }

  return cryptoJS.lib.WordArray.create(words, bytes.length)
}

export const hashWordArray = (
  cryptoJS: CryptoJSModule,
  wordArray: CryptoWordArray,
  subtleDigests: Partial<Record<'sha1' | 'sha256' | 'sha512', string>>
) => ({
  md5: cryptoJS.MD5(wordArray).toString(cryptoJS.enc.Hex),
  sha1: subtleDigests.sha1 ?? cryptoJS.SHA1(wordArray).toString(cryptoJS.enc.Hex),
  sha256: subtleDigests.sha256 ?? cryptoJS.SHA256(wordArray).toString(cryptoJS.enc.Hex),
  sha512: subtleDigests.sha512 ?? cryptoJS.SHA512(wordArray).toString(cryptoJS.enc.Hex)
})
