export interface RegionOption {
  value: string
  cn: string
  en: string
}

export const pensionProvinceOptions: RegionOption[] = [
  { value: 'custom', cn: '自定义/手动填写', en: 'Custom / manual' },
  { value: 'beijing', cn: '北京市', en: 'Beijing' },
  { value: 'tianjin', cn: '天津市', en: 'Tianjin' },
  { value: 'hebei', cn: '河北省', en: 'Hebei' },
  { value: 'shanxi', cn: '山西省', en: 'Shanxi' },
  { value: 'inner-mongolia', cn: '内蒙古自治区', en: 'Inner Mongolia' },
  { value: 'liaoning', cn: '辽宁省', en: 'Liaoning' },
  { value: 'jilin', cn: '吉林省', en: 'Jilin' },
  { value: 'heilongjiang', cn: '黑龙江省', en: 'Heilongjiang' },
  { value: 'shanghai', cn: '上海市', en: 'Shanghai' },
  { value: 'jiangsu', cn: '江苏省', en: 'Jiangsu' },
  { value: 'zhejiang', cn: '浙江省', en: 'Zhejiang' },
  { value: 'anhui', cn: '安徽省', en: 'Anhui' },
  { value: 'fujian', cn: '福建省', en: 'Fujian' },
  { value: 'jiangxi', cn: '江西省', en: 'Jiangxi' },
  { value: 'shandong', cn: '山东省', en: 'Shandong' },
  { value: 'henan', cn: '河南省', en: 'Henan' },
  { value: 'hubei', cn: '湖北省', en: 'Hubei' },
  { value: 'hunan', cn: '湖南省', en: 'Hunan' },
  { value: 'guangdong', cn: '广东省', en: 'Guangdong' },
  { value: 'guangxi', cn: '广西壮族自治区', en: 'Guangxi' },
  { value: 'hainan', cn: '海南省', en: 'Hainan' },
  { value: 'chongqing', cn: '重庆市', en: 'Chongqing' },
  { value: 'sichuan', cn: '四川省', en: 'Sichuan' },
  { value: 'guizhou', cn: '贵州省', en: 'Guizhou' },
  { value: 'yunnan', cn: '云南省', en: 'Yunnan' },
  { value: 'tibet', cn: '西藏自治区', en: 'Tibet' },
  { value: 'shaanxi', cn: '陕西省', en: 'Shaanxi' },
  { value: 'gansu', cn: '甘肃省', en: 'Gansu' },
  { value: 'qinghai', cn: '青海省', en: 'Qinghai' },
  { value: 'ningxia', cn: '宁夏回族自治区', en: 'Ningxia' },
  { value: 'xinjiang', cn: '新疆维吾尔自治区', en: 'Xinjiang' }
]

export const housingFundCityOptions: RegionOption[] = [
  { value: 'custom', cn: '自定义城市', en: 'Custom city' },
  { value: 'beijing', cn: '北京', en: 'Beijing' },
  { value: 'shanghai', cn: '上海', en: 'Shanghai' },
  { value: 'guangzhou', cn: '广州', en: 'Guangzhou' },
  { value: 'shenzhen', cn: '深圳', en: 'Shenzhen' },
  { value: 'hangzhou', cn: '杭州', en: 'Hangzhou' },
  { value: 'nanjing', cn: '南京', en: 'Nanjing' },
  { value: 'suzhou', cn: '苏州', en: 'Suzhou' },
  { value: 'chengdu', cn: '成都', en: 'Chengdu' },
  { value: 'chongqing', cn: '重庆', en: 'Chongqing' },
  { value: 'wuhan', cn: '武汉', en: 'Wuhan' },
  { value: 'xian', cn: '西安', en: "Xi'an" },
  { value: 'tianjin', cn: '天津', en: 'Tianjin' },
  { value: 'qingdao', cn: '青岛', en: 'Qingdao' },
  { value: 'xiamen', cn: '厦门', en: 'Xiamen' },
  { value: 'zhengzhou', cn: '郑州', en: 'Zhengzhou' },
  { value: 'changsha', cn: '长沙', en: 'Changsha' },
  { value: 'ningbo', cn: '宁波', en: 'Ningbo' }
]

export const pensionProvinceOptionMap = new Map(
  pensionProvinceOptions.map(option => [option.value, option])
)

export const housingFundCityOptionMap = new Map(
  housingFundCityOptions.map(option => [option.value, option])
)

export const getRegionLabel = (option: RegionOption | undefined, language: string) => {
  if (!option) return ''
  return language === 'cn' ? option.cn : option.en
}
