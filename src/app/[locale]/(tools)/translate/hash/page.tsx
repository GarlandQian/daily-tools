'use client'
import { useMemo, useState } from 'react'
import CryptoJS from 'crypto-js'
import { Col, Flex, Input, Radio, RadioChangeEvent, Row } from 'antd'
import { useTranslation } from 'react-i18next'

export default function Hash() {
  const { t } = useTranslation()

  const [value, setValue] = useState('')
  const [key, setKey] = useState('')
  const [mode, setMode] = useState('MD5')
  const hash = useMemo(() => {
    switch (mode) {
      case 'MD5':
        return CryptoJS.MD5(value).toString()
      case 'SHA1':
        return CryptoJS.SHA1(value).toString()
      case 'SHA224':
        return CryptoJS.SHA224(value).toString()
      case 'SHA256':
        return CryptoJS.SHA256(value).toString()
      case 'SHA3':
        return CryptoJS.SHA3(value).toString()
      case 'SHA384':
        return CryptoJS.SHA384(value).toString()
      case 'SHA512':
        return CryptoJS.SHA512(value).toString()
      case 'RIPEMD160':
        return CryptoJS.RIPEMD160(value).toString()
      case 'HmacMD5':
        return CryptoJS.HmacMD5(value, key).toString()
      case 'HmacSHA1':
        return CryptoJS.HmacSHA1(value, key).toString()
      case 'HmacSHA224':
        return CryptoJS.HmacSHA224(value, key).toString()
      case 'HmacSHA256':
        return CryptoJS.HmacSHA256(value, key).toString()
      case 'HmacSHA3':
        return CryptoJS.HmacSHA3(value, key).toString()
      case 'HmacSHA384':
        return CryptoJS.HmacSHA384(value, key).toString()
      case 'HmacSHA512':
        return CryptoJS.HmacSHA512(value, key).toString()
      case 'HmacRIPEMD160':
        return CryptoJS.HmacRIPEMD160(value, key).toString()
    }
  }, [mode, value, key])

  const hasKeyInput = useMemo(() => {
    switch (mode) {
      case 'HmacMD5':
      case 'HmacSHA1':
      case 'HmacSHA224':
      case 'HmacSHA256':
      case 'HmacSHA3':
      case 'HmacSHA384':
      case 'HmacSHA512':
      case 'HmacRIPEMD160':
        return true
      default:
        return false
    }
  }, [mode])

  const onChange = (e: RadioChangeEvent) => {
    setKey('')
    setMode(e.target.value)
  }

  return (
    <>
      <Flex vertical gap="middle">
        <Row gutter={[10, 20]}>
          <Col span={1}>{t('app.translate.hash.message')}</Col>
          <Col span={23}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </Col>
          {hasKeyInput && (
            <>
              <Col span={1}>{t('app.translate.hash.key')}</Col>
              <Col span={23}>
                <Input value={key} onChange={(e) => setKey(e.target.value)} />
              </Col>
            </>
          )}
        </Row>
        <Radio.Group value={mode} onChange={onChange}>
          <Radio.Button value="MD5">MD5</Radio.Button>
          <Radio.Button value="SHA1">SHA1</Radio.Button>
          <Radio.Button value="SHA224">SHA224</Radio.Button>
          <Radio.Button value="SHA256">SHA256</Radio.Button>
          <Radio.Button value="SHA3">SHA3</Radio.Button>
          <Radio.Button value="SHA384">SHA384</Radio.Button>
          <Radio.Button value="SHA512">SHA512</Radio.Button>
          <Radio.Button value="RIPEMD160">RIPEMD160</Radio.Button>
          <Radio.Button value="HmacMD5">HmacMD5</Radio.Button>
          <Radio.Button value="HmacSHA1">HmacSHA1</Radio.Button>
          <Radio.Button value="HmacSHA224">HmacSHA224</Radio.Button>
          <Radio.Button value="HmacSHA256">HmacSHA256</Radio.Button>
          <Radio.Button value="HmacSHA3">HmacSHA3</Radio.Button>
          <Radio.Button value="HmacSHA384">HmacSHA384</Radio.Button>
          <Radio.Button value="HmacSHA512">HmacSHA512</Radio.Button>
          <Radio.Button value="HmacRIPEMD160">HmacRIPEMD160</Radio.Button>
        </Radio.Group>
        <div>{hash}</div>
      </Flex>
    </>
  )
}
