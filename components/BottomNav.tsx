'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [profile, setProfile]           = useState<Profile | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data as Profile))
    })
  }, [])

  async function handleLogout() {
    setShowSettings(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={() => setShowSettings(false)}
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${
          showSettings ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 設定面板（從底部滑出） */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 transition-transform duration-300 ${
          showSettings ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ borderTop: '0.5px solid #f3f4f6', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}
      >
        <div className="px-5 pt-4 pb-10">
          {/* 拉桿 */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          {/* 使用者資訊 */}
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
            <div className="w-11 h-11 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-lg font-medium text-gray-700">
              {profile?.name?.[0] ?? '?'}
            </div>
            <div>
              <div className="font-medium text-sm">{profile?.name ?? '—'}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {profile?.role === 'owner' ? '老闆' : '員工'}
              </div>
            </div>
          </div>

          {/* 登出 */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 py-3 text-sm text-red-500 bg-transparent border-none cursor-pointer"
          >
            <i className="ti ti-logout text-xl" aria-hidden="true" />
            登出
          </button>
        </div>
      </div>

      {/* 底部導覽列 */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white z-30 flex"
        style={{ borderTop: '0.5px solid #f3f4f6' }}
      >
        {([
          { href: '/orders', label: '訂單', icon: 'ti-clipboard-list' },
          { href: '/menus',  label: '菜單', icon: 'ti-notebook' },
        ] as const).map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center pt-2.5 pb-3 gap-1 no-underline transition-colors"
              style={{ fontSize: 11, color: active ? '#111' : '#9ca3af' }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 24 }} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}

        <button
          onClick={() => setShowSettings(s => !s)}
          className="flex-1 flex flex-col items-center pt-2.5 pb-3 gap-1 bg-transparent border-none cursor-pointer transition-colors"
          style={{ fontSize: 11, color: showSettings ? '#111' : '#9ca3af' }}
        >
          <i className="ti ti-settings" style={{ fontSize: 24 }} aria-hidden="true" />
          設定
        </button>
      </nav>
    </>
  )
}
