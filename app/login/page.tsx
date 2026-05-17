'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('帳號或密碼錯誤')
      setLoading(false)
    } else {
      router.push('/orders')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-content">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-medium">訂位管理</h1>
          <p className="text-sm text-gray-500 mt-1">請登入以繼續</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? '登入中…' : '登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
