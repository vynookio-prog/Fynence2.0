import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Fynence — Trading Journal', description: 'Trading journal and market intelligence, built around your verified data.' }
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="id"><body><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-[#06251a]">Lewati ke konten utama</a>{children}</body></html> }
