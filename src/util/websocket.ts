import { intervalFn } from './intervalFn'
import { Fn } from './type'

export type WebSocketStatus = 'OPEN' | 'CONNECTING' | 'CLOSED'

const DEFAULT_PING_MESSAGE = 'ping'

export interface UseWebSocketOptions {
  onConnected?: (ws: WebSocket) => void
  onDisconnected?: (ws: WebSocket, event: CloseEvent) => void
  onError?: (ws: WebSocket, event: Event) => void
  onMessage?: (ws: WebSocket, event: MessageEvent) => void

  /**
   * Send heartbeat for every x milliseconds passed
   *
   * @default false
   */
  heartbeat?:
    | boolean
    | {
        /**
         * Message for the heartbeat
         *
         * @default 'ping'
         */
        message?: string | ArrayBuffer | Blob

        /**
         * Response message for the heartbeat, if undefined the message will be used
         */
        responseMessage?: string | ArrayBuffer | Blob

        /**
         * Interval, in milliseconds
         *
         * @default 1000
         */
        interval?: number

        /**
         * Heartbeat response timeout, in milliseconds
         *
         * @default 1000
         */
        pongTimeout?: number
      }

  /**
   * Enabled auto reconnect
   *
   * @default false
   */
  autoReconnect?:
    | boolean
    | {
        /**
         * Maximum retry times.
         *
         * Or you can pass a predicate function (which returns true if you want to retry).
         *
         * @default -1
         */
        retries?: number | (() => boolean)

        /**
         * Delay for reconnect, in milliseconds
         *
         * @default 1000
         */
        delay?: number

        /**
         * On maximum retry times reached.
         */
        onFailed?: Fn
      }

  /**
   * Automatically open a connection
   *
   * @default true
   */
  immediate?: boolean

  /**
   * List of one or more sub-protocol strings
   *
   * @default []
   */
  protocols?: string[]
}

export interface UseWebSocketReturn<T> {
  /**
   * Reference to the latest data received via the websocket,
   * can be watched to respond to incoming messages
   */
  data: T | undefined

  /**
   * The current websocket status, can be only one of:
   * 'OPEN', 'CONNECTING', 'CLOSED'
   */
  status: WebSocketStatus

  /**
   * Closes the websocket connection gracefully.
   */
  close: WebSocket['close']

  /**
   * Reopen the websocket connection.
   * If there the current one is active, will close it before opening a new one.
   */
  open: Fn

  /**
   * Sends data through the websocket connection.
   *
   * @param data
   * @param useBuffer when the socket is not yet open, store the data into the buffer and sent them one connected. Default to true.
   */
  send: (data: string | ArrayBuffer | Blob, useBuffer?: boolean) => boolean

  /**
   * Reference to the WebSocket instance.
   */
  ws: WebSocket | undefined
}

function resolveNestedOptions<T>(options: T | true): T {
  if (options === true) return {} as T
  return options
}

/**
 * WebSocket client.
 * @param url
 */
export function webSocket<Data>(
  url: string | URL | undefined,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn<Data> {
  const {
    onConnected,
    onDisconnected,
    onError,
    onMessage,
    immediate = true,
    protocols = []
  } = options

  let data: Data | undefined = void 0
  let status: WebSocketStatus = 'CLOSED'
  let wsRef: WebSocket | undefined = void 0
  const urlRef = url

  let heartbeatPause: Fn | undefined
  let heartbeatResume: Fn | undefined

  let explicitlyClosed = false
  let retried = 0

  let bufferedData: (string | ArrayBuffer | Blob)[] = []

  let pongTimeoutWait: ReturnType<typeof setTimeout> | undefined

  const _sendBuffer = () => {
    if (bufferedData.length && wsRef && status === 'OPEN') {
      for (const buffer of bufferedData) wsRef.send(buffer)
      bufferedData = []
    }
  }

  const resetHeartbeat = () => {
    clearTimeout(pongTimeoutWait)
    pongTimeoutWait = undefined
  }

  // Status code 1000 -> Normal Closure https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
  const close: WebSocket['close'] = (code = 1000, reason) => {
    if (!wsRef) return
    explicitlyClosed = true
    resetHeartbeat()
    heartbeatPause?.()
    wsRef.close(code, reason)
    wsRef = undefined
  }

  const send = (data: string | ArrayBuffer | Blob, useBuffer = true) => {
    if (!wsRef || status !== 'OPEN') {
      if (useBuffer) bufferedData.push(data)
      return false
    }
    _sendBuffer()
    wsRef.send(data)
    return true
  }

  const _init = () => {
    if (explicitlyClosed || typeof urlRef === 'undefined') return

    const ws = new WebSocket(urlRef, protocols)
    wsRef = ws
    status = 'CONNECTING'

    ws.onopen = () => {
      status = 'OPEN'
      retried = 0
      onConnected?.(ws!)
      heartbeatResume?.()
      _sendBuffer()
    }

    ws.onclose = ev => {
      status = 'CLOSED'
      onDisconnected?.(ws, ev)

      if (!explicitlyClosed && options.autoReconnect && (wsRef == null || ws === wsRef)) {
        const { retries = -1, delay = 1000, onFailed } = resolveNestedOptions(options.autoReconnect)

        if (typeof retries === 'number' && (retries < 0 || retried < retries)) {
          retried += 1
          setTimeout(_init, delay)
        } else if (typeof retries === 'function' && retries()) {
          setTimeout(_init, delay)
        } else {
          onFailed?.()
        }
      }
    }

    ws.onerror = e => {
      onError?.(ws!, e)
    }

    ws.onmessage = (e: MessageEvent) => {
      if (options.heartbeat) {
        resetHeartbeat()
        const { message = DEFAULT_PING_MESSAGE, responseMessage = message } = resolveNestedOptions(
          options.heartbeat
        )
        if (e.data === responseMessage) return
      }

      data = e.data
      onMessage?.(ws!, e)
    }
  }

  if (options.heartbeat) {
    const {
      message = DEFAULT_PING_MESSAGE,
      interval = 1000,
      pongTimeout = 1000
    } = resolveNestedOptions(options.heartbeat)

    const { pause, resume } = intervalFn(
      () => {
        send(message, false)
        if (pongTimeoutWait != null) return
        pongTimeoutWait = setTimeout(() => {
          // auto-reconnect will be trigger with ws.onclose()
          close()
          explicitlyClosed = false
        }, pongTimeout)
      },
      interval,
      { immediate: false }
    )

    heartbeatPause = pause
    heartbeatResume = resume
  }

  const open = () => {
    close()
    explicitlyClosed = false
    retried = 0
    _init()
  }

  if (immediate) open()

  return {
    data,
    status,
    close,
    send,
    open,
    ws: wsRef
  }
}
