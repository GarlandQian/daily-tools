import { webSocket } from '@/util'

const { data } = webSocket(
  'wss://quote.tradeswitcher.com/quote-b-ws-api?token=b5b68025589b5296229cc92c015aa31e-c-app',
  {
    heartbeat: {
      message: JSON.stringify({
        cmd_id: 22000,
        seq_id: 123,
        trace: 'asdfsdfa',
        data: {},
      }),
      interval: 1e4,
      pongTimeout: 3e4,
    },
  }
)

export { data }
