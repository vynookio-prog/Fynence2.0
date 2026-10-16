'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAuthActions } from '@insforge/sdk/ssr'
export type AuthState={error?:string;success?:string}
export async function signIn(_prev:AuthState,formData:FormData):Promise<AuthState>{const auth=createAuthActions({cookies:await cookies()});const {data,error}=await auth.signInWithPassword({email:String(formData.get('email')??''),password:String(formData.get('password')??'')});if(error||!data?.user)return{error:error?.message??'Gagal masuk. Periksa email dan password.'};redirect('/dashboard')}
export async function signUp(_prev:AuthState,formData:FormData):Promise<AuthState>{const auth=createAuthActions({cookies:await cookies()});const {data,error}=await auth.signUp({email:String(formData.get('email')??''),password:String(formData.get('password')??''),name:String(formData.get('name')??'')});if(error)return{error:error.message};if(data?.user)redirect('/dashboard');return{success:'Periksa email untuk menyelesaikan pendaftaran.'}}
export async function signOut(){const auth=createAuthActions({cookies:await cookies()});await auth.signOut();redirect('/login')}
