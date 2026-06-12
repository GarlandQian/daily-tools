export interface BoundedLineResult {
  limited: boolean
  lines: string[]
}

export interface BoundedTokenResult {
  limited: boolean
  tokens: string[]
}

export const collectBoundedNonEmptyLines = (input: string, limit: number): BoundedLineResult => {
  if (limit <= 0) return { limited: input.trim().length > 0, lines: [] }

  const lines: string[] = []
  let lineStart = 0

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index]
    if (index !== input.length && char !== '\n' && char !== '\r') continue

    const line = input.slice(lineStart, index).trim()
    if (line) {
      if (lines.length >= limit) return { limited: true, lines }
      lines.push(line)
    }

    if (char === '\r' && input[index + 1] === '\n') index += 1
    lineStart = index + 1
  }

  return { limited: false, lines }
}

export const collectBoundedTokens = (
  input: string,
  limit: number,
  delimiterPattern: RegExp
): BoundedTokenResult => {
  if (limit <= 0) return { limited: input.trim().length > 0, tokens: [] }

  const tokens: string[] = []
  let tokenStart = -1

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index]
    delimiterPattern.lastIndex = 0
    const isDelimiter =
      index === input.length || (char !== undefined && delimiterPattern.test(char))

    if (!isDelimiter) {
      if (tokenStart < 0) tokenStart = index
      continue
    }

    if (tokenStart >= 0) {
      const token = input.slice(tokenStart, index).trim()
      if (token) {
        if (tokens.length >= limit) return { limited: true, tokens }
        tokens.push(token)
      }
      tokenStart = -1
    }
  }

  return { limited: false, tokens }
}
