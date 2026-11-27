import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import {siteUrl} from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Sarkari Naukari | All Government Jobs. One Platform.', template: '%s | Sarkari Naukari' },
  description: 'Discover verified government vacancies, recruitment notices, admit cards, results and examination updates from across India.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Sarkari Naukari', description: 'All Government Jobs. One Platform.', type: 'website' },
}
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f8fafc', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased"><Toaster position="top-right" richColors />{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
