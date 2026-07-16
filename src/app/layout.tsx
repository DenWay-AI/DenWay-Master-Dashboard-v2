import type { Metadata } from 'next'
import { AppShell } from '@/components/shell/AppShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'DenWay Analytics',
  description: 'Custom analytics dashboard for dental practice growth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
