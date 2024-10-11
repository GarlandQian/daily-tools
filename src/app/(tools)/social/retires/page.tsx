'use client'
import { Button, DatePicker, Form, Radio } from 'antd'
import { useMemo } from 'react'
import { calcRetires, calcRetiresParams } from './util';

const Retires = () => {
  const [form] = Form.useForm<calcRetiresParams>()
  const gender = Form.useWatch('gender', form)
  const isFemale = useMemo(() => gender === 'female', [gender])
  const onFinish = (values: calcRetiresParams) => {
    console.log('Received values of form: ', values);
    const retirement = calcRetires(values);
    console.log(retirement);
  };
  return (
    <>
      <Form labelAlign='left' layout="horizontal" form={form} labelCol={{ span: 2 }} wrapperCol={{ span: 16 }}  onFinish={onFinish}>
        <Form.Item name="birth" label="Birthday" rules={[{ required: true, message: 'Please select your birthday!' }]}>
          <DatePicker />
        </Form.Item>
        <Form.Item name="gender" label="Gender" rules={[{ required: true, message: 'Please select your gender!' }]}>
          <Radio.Group
            options={[
              {
                label: 'male',
                value: 'male',
              },
              {
                label: 'female',
                value: 'female',
              },
            ]}
          />
        </Form.Item>
        {isFemale && (
          <Form.Item name="occupation" label="Occupation" rules={[{ required: true, message: 'Please select your occupation!' }]}>
            <Radio.Group
              options={[
                {
                  label: 'worker',
                  value: 'worker',
                },
                {
                  label: 'staff',
                  value: 'staff',
                },
              ]}
            />
          </Form.Item>
        )}
        <Form.Item>
          <Button type="primary" htmlType="submit">
            submit
          </Button>
        </Form.Item>
      </Form>
    </>
  )
}

export default Retires
