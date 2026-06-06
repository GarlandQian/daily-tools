'use client'

import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

interface SelectOption {
  key: React.Key
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export type SelectProps = NativeSelectProps

function toSelectValue(value: NativeSelectProps['value'] | NativeSelectProps['defaultValue']) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined
  if (value === undefined) return undefined
  return String(value)
}

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = []

  React.Children.forEach(children, child => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return

    if (child.type === React.Fragment) {
      options.push(...collectOptions(child.props.children as React.ReactNode))
      return
    }

    if (child.type === 'optgroup') {
      options.push(...collectOptions(child.props.children as React.ReactNode))
      return
    }

    if (child.type !== 'option') return

    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>
    const fallbackValue =
      typeof props.children === 'string' || typeof props.children === 'number' ? props.children : ''
    const value = String(props.value ?? fallbackValue)

    options.push({
      key: child.key ?? value,
      value,
      label: props.children ?? value,
      disabled: props.disabled
    })
  })

  return options
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      disabled,
      id,
      name,
      required,
      form,
      autoFocus,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref
  ) => {
    const options = React.useMemo(() => collectOptions(children), [children])
    const [internalValue, setInternalValue] = React.useState(
      () => toSelectValue(defaultValue) ?? options[0]?.value ?? ''
    )
    const [open, setOpen] = React.useState(false)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>()
    const reactId = React.useId()
    const triggerId = id ?? `select-${reactId}`
    const listboxId = `${triggerId}-listbox`
    const nativeSelectRef = React.useRef<HTMLSelectElement | null>(null)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)

    const selectedValue = toSelectValue(value) ?? internalValue
    const selectedIndex = Math.max(
      0,
      options.findIndex(option => option.value === selectedValue)
    )
    const selectedOption = options[selectedIndex]

    const setNativeSelectRef = React.useCallback(
      (node: HTMLSelectElement | null) => {
        nativeSelectRef.current = node

        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const updatePopoverPosition = React.useCallback(() => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const margin = 16
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const width = Math.min(Math.max(rect.width, 220), viewportWidth - margin * 2)
      const menuHeight = Math.min(348, options.length * 44 + 12, viewportHeight - margin * 2)
      const belowTop = rect.bottom + 8
      const aboveTop = rect.top - menuHeight - 8
      const openAbove = belowTop + menuHeight > viewportHeight - margin && aboveTop > margin
      const left = Math.min(Math.max(rect.left, margin), viewportWidth - width - margin)
      const top = openAbove ? aboveTop : belowTop

      setPopoverStyle({
        left,
        top: Math.max(margin, Math.min(top, viewportHeight - margin - menuHeight)),
        width,
        maxHeight: menuHeight
      })
    }, [options.length])

    const emitChange = React.useCallback(
      (nextValue: string) => {
        const nativeSelect = nativeSelectRef.current

        if (nativeSelect) {
          nativeSelect.value = nextValue
          onChange?.({
            target: nativeSelect,
            currentTarget: nativeSelect
          } as React.ChangeEvent<HTMLSelectElement>)
        }
      },
      [onChange]
    )

    const selectOption = React.useCallback(
      (option: SelectOption) => {
        if (disabled || option.disabled) return
        if (value === undefined) setInternalValue(option.value)
        emitChange(option.value)
        setOpen(false)
        triggerRef.current?.focus()
      },
      [disabled, emitChange, value]
    )

    React.useEffect(() => {
      if (!open) return

      let animationFrame: number | null = null
      const schedulePopoverPosition = () => {
        if (animationFrame !== null) return
        animationFrame = window.requestAnimationFrame(() => {
          animationFrame = null
          updatePopoverPosition()
        })
      }

      updatePopoverPosition()
      setActiveIndex(selectedIndex)
      window.addEventListener('resize', schedulePopoverPosition, { passive: true })
      window.addEventListener('scroll', schedulePopoverPosition, { capture: true, passive: true })

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpen(false)
          triggerRef.current?.focus()
        }
      }

      window.addEventListener('keydown', handleKeyDown)

      return () => {
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame)
        }
        window.removeEventListener('resize', schedulePopoverPosition)
        window.removeEventListener('scroll', schedulePopoverPosition, { capture: true })
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [open, selectedIndex, updatePopoverPosition])

    const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setOpen(true)
        setActiveIndex(current => {
          const direction = event.key === 'ArrowDown' ? 1 : -1
          const nextIndex = current + direction
          return Math.min(Math.max(nextIndex, 0), options.length - 1)
        })
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (open) {
          const option = options[activeIndex]
          if (option) selectOption(option)
        } else {
          setOpen(true)
        }
      }
    }

    const selectPopover =
      open && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
              <div
                className="glass-select-menu glass-popover glass-clip fixed z-[1000] rounded-2xl p-1.5"
                style={popoverStyle}
              >
                <div
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={triggerId}
                  className="max-h-[inherit] overflow-auto"
                >
                  {options.map((option, index) => {
                    const selected = option.value === selectedValue
                    const active = index === activeIndex

                    return (
                      <button
                        key={option.key}
                        id={`${listboxId}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={option.disabled}
                        className={cn(
                          'glass-select-option flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all',
                          'text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40',
                          selected && 'is-selected',
                          active && !selected && 'is-active'
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectOption(option)}
                      >
                        <span className="min-w-0 truncate">{option.label}</span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>,
            document.body
          )
        : null

    return (
      <>
        <select
          {...props}
          ref={setNativeSelectRef}
          id={id ? `${id}-native` : undefined}
          name={name}
          required={required}
          form={form}
          disabled={disabled}
          value={selectedValue}
          onChange={() => undefined}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        >
          {children}
        </select>
        <button
          id={triggerId}
          ref={triggerRef}
          type="button"
          disabled={disabled}
          autoFocus={autoFocus}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            'glass-select-trigger glass-panel glass-panel-static glass-shimmer glass-clip flex h-11 w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm leading-5',
            'text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          onClick={() => !disabled && setOpen(current => !current)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="min-w-0 truncate">{selectedOption?.label ?? selectedValue}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-200',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
        {selectPopover}
      </>
    )
  }
)
Select.displayName = 'Select'

export { Select }
