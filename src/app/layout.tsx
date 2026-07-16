import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { AppShell } from '@/components/shell/AppShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'DenWay Analytics',
  description: 'Custom analytics dashboard for dental practice growth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <div className="ambient" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
