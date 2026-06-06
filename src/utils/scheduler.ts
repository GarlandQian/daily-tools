export const yieldToMain = () =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, 0)
  })
