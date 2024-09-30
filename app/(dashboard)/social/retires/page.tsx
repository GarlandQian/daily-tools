'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { DatePicker } from '@/components/ui/datepicker';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '@/components/ui/select';

import { calcRetires } from './util';
import { useMemo } from 'react';

const FormSchema = z.object({
  birth: z.string({
    required_error: 'Birthday is required!'
  }),
  gender: z.string({
    required_error: 'Gender is required!'
  }),
  occupation: z.string()
});

export default function InputForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      occupation: ''
    }
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    const v = calcRetires({
      ...data,
      birth: new Date(data.birth)
    });
    console.log(v);
  }

  const isFemale = useMemo(() => form.getValues('gender') === 'male', [form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
        <FormField
          control={form.control}
          name="birth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Birthday</FormLabel>
              <FormControl>
                <DatePicker
                  value={field.value}
                  setValueDate={field.onChange}
                />
              </FormControl>
              <FormDescription>This is your Birthday.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel>Gender</FormLabel>
                <div className="w-[280px]">
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">male</SelectItem>
                      <SelectItem value="female">female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <FormDescription>This is your gender.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {isFemale && (
          <FormField
            control={form.control}
            name="occupation"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center">
                  <FormLabel>Occupation</FormLabel>
                  <div className="w-[280px]">
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your occupation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="worker">worker</SelectItem>
                        <SelectItem value="staff">staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <FormDescription>This is your occupation.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
