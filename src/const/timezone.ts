export const tzListMap = {
  /** 中国时间（China Standard Time）*/
  chinaStandardTime: {
    label: '中国时间（China Standard Time）',
    value: 'Asia/Shanghai'
  },
  /** 日本时间（Japan Standard Time）*/
  japanStandardTime: {
    label: '日本时间（Japan Standard Time）',
    value: 'Asia/Tokyo'
  },
  /** 韩国时间（Korea Standard Time）*/
  koreaStandardTime: {
    label: '韩国时间（Korea Standard Time）',
    value: 'Asia/Seoul'
  },
  /** 澳大利亚东部时间（Australian Eastern Time）*/
  australianEasternTime: {
    label: '澳大利亚东部时间（Australian Eastern Time）',
    value: 'Australia/Sydney'
  },
  /** 新西兰时间（New Zealand Time）*/
  newZealandTime: {
    label: '新西兰时间（New Zealand Time）',
    value: 'Pacific/Auckland'
  },
  /** 印度标准时间（India Standard Time）*/
  indiaStandardTime: {
    label: '印度标准时间（India Standard Time）',
    value: 'Asia/Kolkata'
  },
  /** 莫斯科时间（Moscow Time）*/
  moscowTime: { label: '莫斯科时间（Moscow Time）', value: 'Europe/Moscow' },
  /** 南非标准时间（South Africa Standard Time）*/
  southAfricaStandardTime: {
    label: '南非标准时间（South Africa Standard Time）',
    value: 'Africa/Johannesburg'
  },
  /** 德国时间（Central European Time）*/
  centralEuropeanTime: {
    label: '德国时间（Central European Time）',
    value: 'Europe/Berlin'
  },
  /** 英国时间（Greenwich Mean Time）*/
  greenwichMeanTime: {
    label: '英国时间（Greenwich Mean Time）',
    value: 'Europe/London'
  },
  /** 巴西利亚时间（Brasilia Time）*/
  brasiliaTime: {
    label: '巴西利亚时间（Brasilia Time）',
    value: 'America/Sao_Paulo'
  },
  /** 美国东部时间（Eastern Time）*/
  easternTime: {
    label: '美国东部时间（Eastern Time）',
    value: 'America/New_York'
  },
  /** 美国中部时间（Central Time）*/
  centralTime: {
    label: '美国中部时间（Central Time）',
    value: 'America/Chicago'
  },
  /** 美国山地时间（Mountain Time）*/
  mountainTime: {
    label: '美国山地时间（Mountain Time）',
    value: 'America/Denver'
  },
  /** 美国太平洋时间（Pacific Time）*/
  pacificTime: {
    label: '美国太平洋时间（Pacific Time）',
    value: 'America/Los_Angeles'
  },
  /** 夏威夷时间（Hawaii-Aleutian Time）*/
  hawaiiAleutianTime: {
    label: '夏威夷时间（Hawaii-Aleutian Time）',
    value: 'Pacific/Honolulu'
  },
  /** 基里巴斯时间（Kiribati Time）*/
  kiribatiTime: {
    label: '基里巴斯时间（Kiribati Time）',
    value: 'Pacific/Tarawa'
  },
  /** 斐济时间（Fiji Time）*/
  fijiTime: { label: '斐济时间（Fiji Time）', value: 'Pacific/Fiji' },
  /** 瓦努阿图时间（Vanuatu Time）*/
  vanuatuTime: {
    label: '瓦努阿图时间（Vanuatu Time）',
    value: 'Pacific/Efate'
  },
  /** 吉尔伯特时间（Gilbert Time）*/
  gilbertTime: {
    label: '吉尔伯特时间（Gilbert Time）',
    value: 'Pacific/Tarawa'
  },
  /** 吐瓦鲁时间（Tuvalu Time）*/
  tuvaluTime: { label: '吐瓦鲁时间（Tuvalu Time）', value: 'Pacific/Funafuti' },
  /** 纽埃时间（Niue Time）*/
  niueTime: { label: '纽埃时间（Niue Time）', value: 'Pacific/Niue' },
  /** 汤加时间（Tonga Time）*/
  tongaTime: { label: '汤加时间（Tonga Time）', value: 'Pacific/Tongatapu' },
  /** 马绍尔群岛时间（Marshall Islands Time）*/
  marshallIslandsTime: {
    label: '马绍尔群岛时间（Marshall Islands Time）',
    value: 'Pacific/Majuro'
  },
  /** 密克罗尼西亚时间（Micronesia Time）*/
  micronesiaTime: {
    label: '密克罗尼西亚时间（Micronesia Time）',
    value: 'Pacific/Chuuk'
  },
  /** 帕劳时间（Palau Time）*/
  palauTime: { label: '帕劳时间（Palau Time）', value: 'Pacific/Palau' },
  /** 巴布亚新几内亚时间（Papua New Guinea Time）*/
  papuaNewGuineaTime: {
    label: '巴布亚新几内亚时间（Papua New Guinea Time）',
    value: 'Pacific/Port_Moresby'
  },
  /** 萨摩亚时间（Samoa Time）*/
  samoaTime: { label: '萨摩亚时间（Samoa Time）', value: 'Pacific/Apia' },
  /** 托克劳时间（Tokelau Time）*/
  tokelauTime: {
    label: '托克劳时间（Tokelau Time）',
    value: 'Pacific/Fakaofo'
  },
  /** 新加坡时间（Singapore Time）*/
  singaporeTime: {
    label: '新加坡时间（Singapore Time）',
    value: 'Asia/Singapore'
  },
  /** 香港时间（Hong Kong Time）*/
  hongKongTime: {
    label: '香港时间（Hong Kong Time）',
    value: 'Asia/Hong_Kong'
  },
  /** 泰国时间（Thailand Time）*/
  thailandTime: { label: '泰国时间（Thailand Time）', value: 'Asia/Bangkok' },
  /** 越南时间（Vietnam Time）*/
  vietnamTime: { label: '越南时间（Vietnam Time）', value: 'Asia/Ho_Chi_Minh' },
  /** 菲律宾时间（Philippine Time）*/
  philippineTime: {
    label: '菲律宾时间（Philippine Time）',
    value: 'Asia/Manila'
  },
  /** 马来西亚时间（Malaysia Time）*/
  malaysiaTime: {
    label: '马来西亚时间（Malaysia Time）',
    value: 'Asia/Kuala_Lumpur'
  },
  /** 印尼时间（Indonesia Time）*/
  indonesiaTime: { label: '印尼时间（Indonesia Time）', value: 'Asia/Jakarta' }
} as const

export type tzMap = keyof typeof tzListMap

export const tzDefault = 'chinaStandardTime'
