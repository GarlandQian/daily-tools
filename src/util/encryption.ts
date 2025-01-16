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
 */
function validateKeyAndIvLength(key: string, iv?: CryptoJS.lib.WordArray) {
  const keyLength = CryptoJS.enc.Utf8.parse(key).sigBytes
  if (![16, 24, 32].includes(keyLength)) {
    throw new Error(
      '密钥长度无效。AES 密钥必须为 16 字节（128 位）、24 字节（192 位）或 32 字节（256 位）。'
    )
  }
  if (iv && iv.sigBytes !== 16) {
    throw new Error('初始化向量（IV）长度无效。AES IV 必须为 16 字节（128 位）。')
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
  validateKeyAndIvLength(secret, CryptoJS.enc.Utf8.parse(iv))

  const secretKey = CryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥

  if (isEncrypt) {
    const encrypted = CryptoJS.AES.encrypt(text, secretKey, {
      iv: CryptoJS.enc.Utf8.parse(iv),
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return encrypted.toString()
  } else {
    const decrypted = CryptoJS.AES.decrypt(text, secretKey, {
      iv: CryptoJS.enc.Utf8.parse(iv),
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
  validateKeyAndIvLength(secret, CryptoJS.enc.Utf8.parse(iv))

  const secretKey = CryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥

  if (isEncrypt) {
    const encrypted = CryptoJS.DES.encrypt(text, secretKey, {
      iv: CryptoJS.enc.Utf8.parse(iv),
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return encrypted.toString()
  } else {
    const decrypted = CryptoJS.DES.decrypt(text, secretKey, {
      iv: CryptoJS.enc.Utf8.parse(iv),
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
  validateKeyAndIvLength(secret, CryptoJS.enc.Utf8.parse(iv))

  const secretKey = CryptoJS.enc[encoding].parse(secret) // 使用指定编码解析密钥

  if (isEncrypt) {
    const encrypted = CryptoJS.TripleDES.encrypt(text, secretKey, {
      iv: CryptoJS.enc.Utf8.parse(iv),
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return encrypted.toString()
  } else {
    const decrypted = CryptoJS.TripleDES.decrypt(text, secretKey, {
      iv: CryptoJS.enc.Utf8.parse(iv),
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad[padding],
      format: CryptoJS.format[format]
    })
    return decrypted.toString(CryptoJS.enc.Utf8) // 解密结果一般是字符串，保持 Utf8 解码输出
  }
}
