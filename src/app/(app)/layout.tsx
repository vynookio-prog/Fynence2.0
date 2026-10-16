import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@insforge/sdk/ssr'
import { AppShell } from '@/components/app-shell'
export default async function PrivateLayout({children}:{children:React.ReactNode}) {
 const client=createServerClient({cookies:await cookies()})
 const {data}=await client.auth.getCurrentUser()
 if(!data?.user) redirect('/login')
 return <AppShell>{children}</AppShell>
}
