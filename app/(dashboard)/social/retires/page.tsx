'use client';
import * as Form from '@radix-ui/react-form';
import { calcRetires } from './util';
import { useEffect, useMemo, useState } from 'react';

export default function CustomersPage() {
  const [data, setData] = useState({
    gender: 'male' as 'male' | 'female',
    birth: new Date('1996-06-19')
  });

  const retirementData = useMemo(() => calcRetires(data), [data]);

  useEffect(() => {
    console.log(retirementData);
  }, [retirementData]);

  const [validateState, setValidateState] = useState(true);
  const submit = () => {
    if (!validateState) {
      return;
    }
  };

  return (
    <Form.Root onSubmit={submit}>
        <Form.Control >
          {/* <Form.FormLabel></Form.FormLabel> */}
        </Form.Control>
    </Form.Root>
  );
}
