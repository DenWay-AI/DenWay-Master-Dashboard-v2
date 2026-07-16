interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  filled?: boolean
}

export default function Sparkline({ data, width = 80, height = 28, color = 'var(--accent)', filled = true }: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pad = 2
  const iw = width - pad * 2
  const ih = height - pad * 2

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * iw,
    y: pad + (1 - (v - min) / range) * ih,
  }))

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(pad + ih).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad + ih).toFixed(1)} Z`
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {filled && <path d={area} fill={color} fillOpacity={0.1} />}
      <path d={line} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </svg>
  )
}
