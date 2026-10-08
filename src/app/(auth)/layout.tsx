import { Outlet } from 'react-router'
import { AuthHero } from '@/features/auth/AuthHero'

/** Split screen: brand panel on the left, the auth form centered on the right. */
export default function AuthLayout() {
  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))]">
      <AuthHero />
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
