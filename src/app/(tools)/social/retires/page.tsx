'use client'
import { Button, DatePicker, Form, Radio } from 'antd'
import { createStyles } from 'antd-style'
import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { calcRetires, calcRetiresParams, calcRetiresReturnType } from './util'

const useStyles = createStyles(({ css }) => ({
  warpper: css`
    margin-top: 200px;
    margin-left: 250px;
    width: 1000px;
    position: relative;
    perspective: 40em;
    display: grid;
    transform-style: preserve-3d;
    &:before {
      --bw: 9px;
      grid-area: 1 / 1;
      content: '';
      backface-visibility: hidden;
      height: 100%;
      width: 100%;
      margin-top: calc(-1 * var(--bw));
      margin-left: calc(-1 * var(--bw));
      background: transparent;
      transform: translateX(-60px) rotateY(-30deg) rotateX(15deg) scale(1.03);
      pointer-events: none;
      border: var(--bw) solid #000;
      box-sizing: content-box;
    }
    &:hover > div,
    &:hover:before {
      transform: none;
    }
    > div,
    &:before {
      will-change: transform;
      transition: 0.3s transform cubic-bezier(0.25, 0.46, 0.45, 1);
    }
  `,
  card: css`
    grid-area: 1 / 1;
    height: 200px;
    width: auto;
    transform: translateX(10px) rotateY(25deg) rotateX(10deg);
    background: rgba(249, 198, 26, 0.88);
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 30px;
    color: #000;
    text-transform: uppercase;
    font-size: 40px;
    font-weight: 900;
    backface-visibility: hidden;
    box-shadow: 0 10px 30px -3px rgba(0, 0, 0, 0.1);
  `,
  enclosed: css`
    background: #000;
    line-height: 1;
    color: rgba(249, 198, 26, 1);
    padding: 0 5px;
    display: inline-block;
    transform: translate(-1px, 1px) scale(0.75);
    transform-origin: right center;
    text-align: center;
  `,
}))

const Retires = () => {
  const { styles } = useStyles()

  const [form] = Form.useForm<calcRetiresParams>()
  const gender = Form.useWatch('gender', form)
  const isFemale = useMemo(() => gender === 'female', [gender])

  const [retirement, setRetirement] = useState<calcRetiresReturnType>()
  const onFinish = (values: calcRetiresParams) => {
    setRetirement(calcRetires(values))
  }
  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        labelCol={{ span: 2 }}
        wrapperCol={{ span: 16 }}
        onFinish={onFinish}
      >
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
          <Form.Item
            name="occupation"
            label="Occupation"
            rules={[{ required: true, message: 'Please select your occupation!' }]}
          >
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
      <AnimatePresence>
        {retirement && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 1 }}
          >
            <div className={styles.warpper}>
              <div className={styles.card}>
                {retirement &&
                  (retirement.newRetirementPolicy ? (
                    <>
                      <span className={styles.enclosed}>
                        退休时间为{dayjs(retirement.retirementDate).format('YYYY年MM月DD日')}。
                      </span>
                      到时你已
                      {retirement.baseRetirementAge}岁
                      {retirement.baseRetirementMonth ? `${retirement.baseRetirementMonth}月` : ''}。
                    </>
                  ) : (
                    <>
                      <span className={styles.enclosed}>
                        退休时间为{dayjs(retirement.retirementDate).format('YYYY年MM月DD日')}。
                      </span>
                      到时你已
                      {retirement.baseRetirementAge}岁。
                    </>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Retires
