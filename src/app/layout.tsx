import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Fynence — Trading Journal', description: 'Trading journal and market intelligence, built around your verified data.' }
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="id"><body>{children}</body></html> }
