import { createFromIconfontCN } from '@ant-design/icons'

const IconFont = createFromIconfontCN({
  scriptUrl: [process.env.NEXT_PUBLIC_ICON_FONT_URL]
})

export default IconFont
