import CryptoJS from 'crypto-js'

// 定义支持的加密模式、填充方式和编码格式类型
type AesMode = keyof typeof CryptoJS.mode
type AesPadding = keyof typeof CryptoJS.pad
type AesEncoding = keyof typeof CryptoJS.enc
type AesFormat = keyof typeof CryptoJS.format

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
function validateKeyAndIvLength(key: string, iv: CryptoJS.lib.WordArray | undefined, mode: AesMode) {
  const keyLength = CryptoJS.enc.Utf8.parse(key).sigBytes
  if (![16, 24, 32].includes(keyLength)) {
    throw new Error('app.encryption.aes.key.length')
  }
  // ECB 模式不需要 IV，忽略 IV 长度检查
  if (mode !== 'ECB' && iv && iv.sigBytes !== 16) {
    throw new Error('app.encryption.aes.iv.length')
  }
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
): string {
  const { iv, mode, padding, format, encoding } = options

  // 检查密钥和 IV 的长度
  validateKeyAndIvLength(secret, iv ? CryptoJS.enc.Utf8.parse(iv) : undefined, mode)

  const secretKey = CryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥

  if (isEncrypt) {
    const encrypted = CryptoJS.AES.encrypt(text, secretKey, {
      iv: iv ? CryptoJS.enc.Utf8.parse(iv) : undefined,
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return encrypted.toString()
  } else {
    const decrypted = CryptoJS.AES.decrypt(text, secretKey, {
      iv: iv ? CryptoJS.enc.Utf8.parse(iv) : undefined,
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return decrypted.toString(CryptoJS.enc.Utf8) // 解密结果一般是字符串，保持 Utf8 解码输出
  }
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
): string {
  const { iv, mode, padding, format, encoding } = options

  // 检查密钥和 IV 的长度
  validateKeyAndIvLength(secret, iv ? CryptoJS.enc.Utf8.parse(iv) : undefined, mode)

  const secretKey = CryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥

  if (isEncrypt) {
    const encrypted = CryptoJS.DES.encrypt(text, secretKey, {
      iv: iv ? CryptoJS.enc.Utf8.parse(iv) : undefined,
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return encrypted.toString()
  } else {
    const decrypted = CryptoJS.DES.decrypt(text, secretKey, {
      iv: iv ? CryptoJS.enc.Utf8.parse(iv) : undefined,
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return decrypted.toString(CryptoJS.enc.Utf8) // 解密结果一般是字符串，保持 Utf8 解码输出
  }
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
): string {
  const { iv, mode, padding, format, encoding } = options

  // 检查密钥和 IV 的长度
  validateKeyAndIvLength(secret, iv ? CryptoJS.enc.Utf8.parse(iv) : undefined, mode)

  const secretKey = CryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥

  if (isEncrypt) {
    const encrypted = CryptoJS.TripleDES.encrypt(text, secretKey, {
      iv: iv ? CryptoJS.enc.Utf8.parse(iv) : undefined,
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return encrypted.toString()
  } else {
    const decrypted = CryptoJS.TripleDES.decrypt(text, secretKey, {
      iv: iv ? CryptoJS.enc.Utf8.parse(iv) : undefined,
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return decrypted.toString(CryptoJS.enc.Utf8) // 解密结果一般是字符串，保持 Utf8 解码输出
  }
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
