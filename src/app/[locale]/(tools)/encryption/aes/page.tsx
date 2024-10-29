// import { encrypt, decrypt } from '@/util'
import { Form } from 'antd'

interface EncryptionType {
  str: string
  secret: string
  iv: string
  enc: keyof typeof CryptoJS.enc
  mode: keyof typeof CryptoJS.mode
  pad: keyof typeof CryptoJS.pad
  format: keyof typeof CryptoJS.format
}

const AESPage = () => {
  const [form] = Form.useForm<EncryptionType>()
  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        labelCol={{ span: 2 }}
        wrapperCol={{ span: 16 }}
        // onFinish={onFinish}
      ></Form>
    </>
  )
}

export default AESPage
