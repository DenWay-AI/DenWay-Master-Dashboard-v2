'use client'

interface DateRangePickerProps {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

export default function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <label htmlFor="date-from" className="label-dark">From</label>
        <input
          id="date-from"
          type="date"
          value={from}
          onChange={e => onFromChange(e.target.value)}
          className="input-dark"
          style={{ minWidth: '140px' }}
        />
      </div>
      <div>
        <label htmlFor="date-to" className="label-dark">To</label>
        <input
          id="date-to"
          type="date"
          value={to}
          onChange={e => onToChange(e.target.value)}
          className="input-dark"
          style={{ minWidth: '140px' }}
        />
      </div>
    </div>
  )
}
