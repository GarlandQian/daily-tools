// 定义支持的加密模式、填充方式和编码格式类型
type AesMode = 'CBC' | 'CFB' | 'CTR' | 'ECB' | 'OFB'
type AesPadding = 'AnsiX923' | 'Iso10126' | 'Iso97971' | 'NoPadding' | 'Pkcs7' | 'ZeroPadding'
type AesEncoding = 'Base64' | 'Hex' | 'Latin1' | 'Utf8'
type AesFormat = 'Hex' | 'OpenSSL'
type SymmetricAlgorithm = 'AES' | 'DES' | 'TripleDES'
type CryptoJSModule = typeof import('crypto-js')
type CryptoJSImport = CryptoJSModule & { default?: CryptoJSModule }
type CryptoWordArray = ReturnType<CryptoJSModule['enc']['Utf8']['parse']>

export interface AesCryptoOptions {
  iv: string // 初始化向量，部分模式必需
  mode: AesMode // 加密模式（限制为CryptoJS支持的模式）
  padding: AesPadding // 填充方式（限制为CryptoJS支持的填充）
  format: AesFormat // 输出格式，通常使用 OpenSSL
  encoding: AesEncoding // 编码方式，限制为 CryptoJS 提供的几种编码
}

/**
 * 检查密钥和 IV 的长度是否有效
 * @param key 密钥
 * @param iv 初始化向量
 * @param mode 加密模式
 */
const KEY_LENGTHS: Record<SymmetricAlgorithm, number[]> = {
  AES: [16, 24, 32],
  DES: [8],
  TripleDES: [16, 24]
}

const IV_LENGTHS: Record<SymmetricAlgorithm, number> = {
  AES: 16,
  DES: 8,
  TripleDES: 8
}

let cryptoPromise: Promise<CryptoJSModule> | null = null

const loadCryptoJS = () => {
  cryptoPromise ??= import('crypto-js').then(module => {
    const loaded = module as CryptoJSImport
    return loaded.default ?? loaded
  })

  return cryptoPromise
}

function validateKeyAndIvLength(
  algorithm: SymmetricAlgorithm,
  key: CryptoWordArray,
  iv: CryptoWordArray | undefined,
  mode: AesMode
) {
  if (!KEY_LENGTHS[algorithm].includes(key.sigBytes)) {
    throw new Error(
      algorithm === 'AES'
        ? 'app.encryption.aes.key.length'
        : `app.encryption.symmetric.key_length.${algorithm === 'DES' ? 'des' : 'tripledes'}`
    )
  }
  // ECB 模式不需要 IV，忽略 IV 长度检查
  if (mode !== 'ECB' && iv && iv.sigBytes !== IV_LENGTHS[algorithm]) {
    throw new Error(
      algorithm === 'AES'
        ? 'app.encryption.aes.iv.length'
        : `app.encryption.symmetric.iv_length.${algorithm === 'DES' ? 'des' : 'tripledes'}`
    )
  }
}

const runSymmetricCrypto = (
  cryptoJS: CryptoJSModule,
  algorithm: SymmetricAlgorithm,
  text: string,
  secret: string,
  options: AesCryptoOptions,
  isEncrypt: boolean
) => {
  const { iv, mode, padding, format, encoding } = options

  const secretKey = cryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥
  const ivWordArray = iv ? cryptoJS.enc.Utf8.parse(iv) : undefined

  // 检查密钥和 IV 的长度
  validateKeyAndIvLength(algorithm, secretKey, ivWordArray, mode)

  const operationOptions = {
    iv: ivWordArray,
    mode: cryptoJS.mode[mode],
    padding: cryptoJS.pad[padding],
    format: cryptoJS.format[format]
  }

  if (algorithm === 'AES') {
    if (isEncrypt) return cryptoJS.AES.encrypt(text, secretKey, operationOptions).toString()
    return cryptoJS.AES.decrypt(text, secretKey, operationOptions).toString(cryptoJS.enc.Utf8)
  }

  if (algorithm === 'DES') {
    if (isEncrypt) return cryptoJS.DES.encrypt(text, secretKey, operationOptions).toString()
    return cryptoJS.DES.decrypt(text, secretKey, operationOptions).toString(cryptoJS.enc.Utf8)
  }

  if (isEncrypt) return cryptoJS.TripleDES.encrypt(text, secretKey, operationOptions).toString()
  return cryptoJS.TripleDES.decrypt(text, secretKey, operationOptions).toString(cryptoJS.enc.Utf8)
}

/**
 * 通用 AES 加密/解密方法
 * @param text - 要加密或解密的文本。
 * @param secret - 密钥。
 * @param options - 配置项，例如模式、填充方式、IV等。
 * @param isEncrypt - 是否加密，true 为加密，false 为解密。
 * @returns 加密或解密后的文本。
 */
export function aesCrypto(
  text: string,
  secret: string,
  options: AesCryptoOptions,
  isEncrypt: boolean = true
): Promise<string> {
  return loadCryptoJS().then(cryptoJS =>
    runSymmetricCrypto(cryptoJS, 'AES', text, secret, options, isEncrypt)
  )
}

/**
 * 通用 DES 加密/解密方法
 * @param text - 要加密或解密的文本。
 * @param secret - 密钥。
 * @param options - 配置项，例如模式、填充方式、IV等。
 * @param isEncrypt - 是否加密，true 为加密，false 为解密。
 * @returns 加密或解密后的文本。
 */
export function desCrypto(
  text: string,
  secret: string,
  options: AesCryptoOptions,
  isEncrypt: boolean = true
): Promise<string> {
  return loadCryptoJS().then(cryptoJS =>
    runSymmetricCrypto(cryptoJS, 'DES', text, secret, options, isEncrypt)
  )
}

/**
 * 通用 TripleDES 加密/解密方法
 * @param text - 要加密或解密的文本。
 * @param secret - 密钥。
 * @param options - 配置项，例如模式、填充方式、IV等。
 * @param isEncrypt - 是否加密，true 为加密，false 为解密。
 * @returns 加密或解密后的文本。
 */
export function TripleDesCrypto(
  text: string,
  secret: string,
  options: AesCryptoOptions,
  isEncrypt: boolean = true
): Promise<string> {
  return loadCryptoJS().then(cryptoJS =>
    runSymmetricCrypto(cryptoJS, 'TripleDES', text, secret, options, isEncrypt)
  )
}

export const aesModes = [
  { label: 'ECB', value: 'ECB' },
  { label: 'CBC', value: 'CBC' },
  { label: 'CFB', value: 'CFB' },
  { label: 'OFB', value: 'OFB' },
  { label: 'CTR', value: 'CTR' }
]

export const aesPaddings = [
  { label: 'Pkcs7', value: 'Pkcs7' },
  { label: 'ZeroPadding', value: 'ZeroPadding' },
  { label: 'NoPadding', value: 'NoPadding' },
  { label: 'AnsiX923', value: 'AnsiX923' },
  { label: 'Iso10126', value: 'Iso10126' },
  { label: 'Iso97971', value: 'Iso97971' }
]

export const aesFormats = [
  { label: 'OpenSSL', value: 'OpenSSL' },
  { label: 'Hex', value: 'Hex' }
]

export const aesEncodings = [
  { label: 'UTF-8', value: 'Utf8' },
  { label: 'Hex', value: 'Hex' },
  { label: 'Base64', value: 'Base64' },
  { label: 'Latin1', value: 'Latin1' }
]
