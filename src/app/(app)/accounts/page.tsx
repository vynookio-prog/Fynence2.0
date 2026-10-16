import Link from 'next/link'
import { ArrowLeft, WalletCards } from 'lucide-react'
import { AccountRow } from '@/components/account-row'
import { NewAccountForm } from '@/components/new-account-form'
import { accountTradeCounts, listAccounts } from '@/lib/accounts/query'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const [accounts, counts] = await Promise.all([listAccounts(), accountTradeCounts()])

  return (
    <div className="mx-auto max-w-[820px] space-y-7">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground">
        <ArrowLeft size={14} />Dashboard
      </Link>

      <div>
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent"><WalletCards size={18} /></div>
        <h1 className="text-3xl font-semibold tracking-tight">Akun trading</h1>
        <p className="mt-2 text-sm text-muted">Kelompokkan catatan jurnalmu. Tanpa koneksi broker dan tanpa saldo tersinkron.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Akunmu</h2>
          <span className="text-[11px] text-muted">{accounts.length} akun</span>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <WalletCards size={20} className="mx-auto text-muted" />
            <p className="mt-3 text-sm font-medium">Belum ada akun</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Buat akun untuk mengelompokkan trade. Catatan jurnal tetap berfungsi tanpa akun.</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {accounts.map(account => (
              <AccountRow key={account.id} account={account} tradeCount={counts[account.id] ?? 0} />
            ))}
          </div>
        )}
        <p className="text-[11px] leading-5 text-muted">
          Akun dan saldo awal diisi manual dan tidak mewakili equity broker. Trade yang masih menempel pada sebuah akun harus dipindahkan sebelum akun itu bisa dihapus.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Tambah akun</h2>
        <NewAccountForm />
      </section>

      <p className="rounded-lg border border-border bg-surface p-4 text-xs leading-5 text-muted">
        Catatan akun bersifat privat untuk pengguna yang sedang masuk. Tidak ada nomor akun broker, kredensial, atau data posisi yang diminta.
      </p>
    </div>
  )
}
