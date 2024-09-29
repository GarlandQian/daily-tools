'use client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { calcRetires } from './util';
import { useEffect, useState } from 'react';

export default function CustomersPage() {
  const [data, setData] = useState({
    gender: 'male', birth: new Date('1996-06-19')
  })

  useEffect(() => {
    console.log(calcRetires(data))
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <CardDescription>View all customers and their orders.</CardDescription>
      </CardHeader>
      <CardContent></CardContent>
    </Card>
  );
}
