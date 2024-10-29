/**
 * 加密
 * @param {string} str 需要加密的数据
 * @param {string} secret 密钥 ()
 * @param {string} iv 偏移量（必须是16的倍数）
 * @param {keyof typeof CryptoJS.enc} enc 字符集
 * @param {keyof typeof CryptoJS.mode} mode 模式
 * @param {keyof typeof CryptoJS.pad} pad 填充
 * @param {keyof typeof CryptoJS.format} format 输出格式
 * @returns AES加密数据
 */
export function encrypt(
  str: string,
  secret: string,
  {
    iv,
    enc,
    mode,
    pad,
    format,
  }: {
    iv: string
    enc: keyof typeof CryptoJS.enc
    mode: keyof typeof CryptoJS.mode
    pad: keyof typeof CryptoJS.pad
    format: keyof typeof CryptoJS.format
  }
) {
  const cryptoKey = CryptoJS.enc[enc].parse(secret)
  const cryptoOption = {
    iv: CryptoJS.enc[enc].parse(iv),
    mode: CryptoJS.mode[mode],
    padding: CryptoJS.pad[pad],
  }
  const encryptedStr = CryptoJS.AES.encrypt(str, cryptoKey, cryptoOption).toString(CryptoJS.format[format])
  return encryptedStr
}

/**
 * 解密
 * @param {string} str 需要解密的数据
 * @param {string} secret 密钥
 * @param {string} iv 偏移量（必须是16的倍数）
 * @param {keyof typeof CryptoJS.enc} enc 字符集
 * @param {keyof typeof CryptoJS.mode} mode 模式
 * @param {keyof typeof CryptoJS.pad} pad 填充
 * @returns
 */
export function decrypt(
  str: string,
  secret: string,
  {
    iv,
    enc,
    mode,
    pad,
  }: {
    iv: string
    enc: keyof typeof CryptoJS.enc
    mode: keyof typeof CryptoJS.mode
    pad: keyof typeof CryptoJS.pad
  }
) {
  const cryptoKey = CryptoJS.enc[enc].parse(secret)
  const cryptoOption = {
    iv: CryptoJS.enc[enc].parse(iv),
    mode: CryptoJS.mode[mode],
    padding: CryptoJS.pad[pad],
  }
  const decryptedStr = CryptoJS.AES.decrypt(str, cryptoKey, cryptoOption).toString(CryptoJS.enc[enc])
  return decryptedStr
}
