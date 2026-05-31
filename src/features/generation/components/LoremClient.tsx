'use client'

import { LoremIpsum } from 'lorem-ipsum'
import { Copy, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCopy } from '@/hooks/useCopy'

type LoremUnit = 'paragraphs' | 'sentences' | 'words'

interface LoremFormData {
  count: number
  unit: LoremUnit
}

const lorem = new LoremIpsum({
  sentencesPerParagraph: { max: 8, min: 4 },
  wordsPerSentence: { max: 16, min: 4 }
})

const LoremClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [formData, setFormData] = useState<LoremFormData>({
    count: 3,
    unit: 'paragraphs'
  })
  const [output, setOutput] = useState('')

  const handleGenerate = useCallback(() => {
    const { count, unit } = formData
    let text = ''

    switch (unit) {
      case 'paragraphs':
        text = lorem.generateParagraphs(count)
        break
      case 'sentences':
        text = lorem.generateSentences(count)
        break
      case 'words':
        text = lorem.generateWords(count)
        break
    }

    setOutput(text)
  }, [formData])

  return (
    <div className="size-full flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.lorem')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="count">{t('app.generation.lorem.count')}</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={formData.count}
                onChange={e => setFormData(prev => ({ ...prev, count: Number(e.target.value) }))}
                className="w-20"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('app.generation.lorem.unit')}</Label>
              <RadioGroup
                value={formData.unit}
                onValueChange={value =>
                  setFormData(prev => ({ ...prev, unit: value as LoremUnit }))
                }
                className="flex gap-2"
              >
                <label className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg cursor-pointer hover:glass-panel-strong transition-all">
                  <RadioGroupItem value="paragraphs" />
                  <span className="text-sm">{t('app.generation.lorem.paragraphs')}</span>
                </label>
                <label className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg cursor-pointer hover:glass-panel-strong transition-all">
                  <RadioGroupItem value="sentences" />
                  <span className="text-sm">{t('app.generation.lorem.sentences')}</span>
                </label>
                <label className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg cursor-pointer hover:glass-panel-strong transition-all">
                  <RadioGroupItem value="words" />
                  <span className="text-sm">{t('app.generation.lorem.words')}</span>
                </label>
              </RadioGroup>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={handleGenerate}
              >
                {t('public.generate')}
              </Button>
              <Button
                icon={<Copy className="w-4 h-4" />}
                onClick={() => copy(output)}
                disabled={!output}
              >
                {t('app.generation.uuid.copy')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle>{t('app.generation.lorem.output')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="whitespace-pre-wrap leading-relaxed text-sm p-4 glass-input rounded-lg min-h-[200px]">
            {output || t('app.generation.lorem.placeholder')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoremClient
