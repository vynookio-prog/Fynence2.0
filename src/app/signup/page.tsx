import { AuthForm } from '@/components/auth-form'
import { getOAuthProviders } from '@/lib/insforge/auth-config'
export const dynamic='force-dynamic'
export default async function SignupPage(){const providers=await getOAuthProviders();return <AuthForm mode="signup" providers={providers}/>}
