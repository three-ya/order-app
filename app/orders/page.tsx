'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderFormData, Adjustment, Profile } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
function toLocalDate(d: Date) {
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`
}
function fmtMoney(n: number) {
  return '$' + Math.abs(n).toLocaleString()
}
function orderTotal(o: Order) {
  const adj = (o.adjustments ?? []).reduce((s, a) => s + (a.amount ?? 0), 0)
  return o.unit_price * o.quantity + adj
}
function blankForm(date: string): OrderFormData {
  return {
    order_date: date,
    confirmed: false,
    time_text: '',
    table_no: '',
    customer_name: '',
    unit_price: 0,
    quantity: 1,
    adjustments: [],
    phone: '',
    note: '',
    menu_id: null,
  }
}

// ─── csv export ─────────────────────────────────────────────────
function exportCSV(orders: Order[], date: string) {
  const headers = ['確認', '時間', '桌位', '姓名', '單價', '數量', '調整項目', '調整金額', '總計', '電話', '備註']
  const rows = orders.map(o => {
    const adjText = (o.adjustments ?? []).map(a => `${a.name}:${a.amount}`).join('; ')
    const adjSum  = (o.adjustments ?? []).reduce((s, a) => s + a.amount, 0)
    return [
      o.confirmed ? '✓' : '',
      o.time_text ?? '',
      o.table_no ?? '',
      o.customer_name ?? '',
      o.unit_price,
      o.quantity,
      adjText,
      adjSum,
      orderTotal(o),
      o.phone ?? '',
      o.note ?? '',
    ]
  })
  const csv = [headers, ...rows]
    .map(r => r.map(c => { const s = String(c); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `訂單_${date}.csv` })
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// ─── components ─────────────────────────────────────────────────

function AdjustmentsField({ value, onChange }: {
  value: Adjustment[]
  onChange: (v: Adjustment[]) => void
}) {
  function add() { onChange([...value, { name: '', amount: 0 }]) }
  function remove(i: number) { onChange(value.filter((_, idx) => idx !== i)) }
  function update(i: number, field: keyof Adjustment, v: string | number) {
    const next = [...value]
    next[i] = { ...next[i], [field]: v }
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {value.map((adj, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="flex-1"
            placeholder="名稱（素食半桌、訂金扣抵…）"
            value={adj.name}
            onChange={e => update(i, 'name', e.target.value)}
          />
          <input
            type="number"
            className="w-28"
            placeholder="金額"
            value={adj.amount || ''}
            onChange={e => update(i, 'amount', parseInt(e.target.value) || 0)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-gray-400 hover:text-red-500 px-1 text-lg leading-none"
          >×</button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-gray-500 hover:text-gray-900"
      >+ 新增調整項目</button>
    </div>
  )
}

function OrderForm({ initial, onSave, onCancel }: {
  initial: OrderFormData
  onSave: (data: OrderFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<OrderFormData>(initial)
  const [saving, setSaving] = useState(false)

  function set(field: keyof OrderFormData, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">桌位</label>
          <input placeholder="A6A7" value={form.table_no} onChange={e => set('table_no', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">時間</label>
          <input placeholder="6:30" value={form.time_text} onChange={e => set('time_text', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 block mb-1">客戶姓名</label>
          <input placeholder="王先生" value={form.customer_name ?? ''} onChange={e => set('customer_name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">單價</label>
          <input type="number" placeholder="4000" value={form.unit_price || ''} onChange={e => set('unit_price', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">數量（桌）</label>
          <input type="number" min={1} value={form.quantity} onChange={e => set('quantity', parseInt(e.target.value) || 1)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 block mb-1">電話</label>
          <input placeholder="0912345678" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className="text-xs text-gray-500 block mb-1">備註</label>
          <input placeholder="特殊需求…" value={form.note} onChange={e => set('note', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-2">調整項目（可加多項，扣抵填負數）</label>
        <AdjustmentsField value={form.adjustments} onChange={v => set('adjustments', v)} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          取消
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </form>
  )
}

function OrderRow({ order, onToggle, onEdit, onDelete }: {
  order: Order
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const adjs = order.adjustments ?? []
  const total = orderTotal(order)

  return (
    <div className={`grid grid-cols-[28px_1fr_120px_64px] gap-3 px-4 py-3 border-b border-gray-100 last:border-0 items-start ${!order.confirmed ? 'opacity-60' : ''}`}>
      {/* confirm toggle */}
      <button
        onClick={onToggle}
        className={`w-[22px] h-[22px] rounded-full border mt-0.5 flex items-center justify-center text-xs shrink-0 ${
          order.confirmed
            ? 'bg-green-50 border-green-400 text-green-600'
            : 'border-gray-300 text-transparent hover:border-gray-500'
        }`}
        aria-label={order.confirmed ? '取消確認' : '確認'}
      >✓</button>

      {/* content */}
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {order.table_no && (
            <span className="font-mono text-xs bg-gray-100 border border-gray-200 rounded px-2 py-0.5">{order.table_no}</span>
          )}
          {order.time_text && (
            <span className="text-xs bg-blue-50 text-blue-600 rounded px-2 py-0.5">🕐 {order.time_text}</span>
          )}
          <span className="font-medium text-sm">{order.customer_name || '（未填）'}</span>
        </div>
        {(order.phone || order.note) && (
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            {order.phone && <span>📞 {order.phone}</span>}
            {order.note && <span>📝 {order.note}</span>}
          </div>
        )}
      </div>

      {/* amount */}
      <div className="text-right">
        <div className="text-xs text-gray-400 font-mono">{order.unit_price.toLocaleString()} × {order.quantity}</div>
        {adjs.map((a, i) => (
          <div key={i} className={`text-xs font-mono ${a.amount < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {a.amount >= 0 ? '+' : '−'} {fmtMoney(a.amount)}
          </div>
        ))}
        <div className="text-sm font-medium mt-0.5">{fmtMoney(total)}</div>
      </div>

      {/* actions */}
      <div className="flex justify-end gap-1 pt-0.5">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" aria-label="編輯">✏️</button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" aria-label="刪除">🗑</button>
      </div>
    </div>
  )
}

// ─── main page ──────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [currentDate, setCurrentDate] = useState(toLocalDate(new Date()))
  const [orders, setOrders]           = useState<Order[]>([])
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  // fetch profile
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  // fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(id, name, role)')
      .eq('order_date', currentDate)
      .order('created_at', { ascending: true })
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }, [currentDate])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  // stats
  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (o.customer_name ?? '').toLowerCase().includes(q) || (o.phone ?? '').includes(q)
  })
  const totalAmount  = filtered.reduce((s, o) => s + orderTotal(o), 0)
  const confirmedCnt = filtered.filter(o => o.confirmed).length

  // date nav
  function changeDate(delta: number) {
    const d = new Date(currentDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setCurrentDate(toLocalDate(d))
  }

  // CRUD
  async function handleSave(data: OrderFormData) {
    const { user } = (await supabase.auth.getUser()).data
    if (!user) return
    const payload = { ...data, created_by: user.id }
    if (editingOrder) {
      await supabase.from('orders').update(payload).eq('id', editingOrder.id)
    } else {
      await supabase.from('orders').insert(payload)
    }
    setShowForm(false)
    setEditingOrder(null)
    fetchOrders()
  }

  async function handleToggle(order: Order) {
    await supabase.from('orders').update({ confirmed: !order.confirmed }).eq('id', order.id)
    fetchOrders()
  }

  async function handleDelete(order: Order) {
    if (!confirm(`確定刪除「${order.customer_name ?? order.table_no}」這筆訂單？`)) return
    await supabase.from('orders').delete().eq('id', order.id)
    fetchOrders()
  }

  function startEdit(order: Order) {
    setEditingOrder(order)
    setShowForm(true)
  }

  function startAdd() {
    setEditingOrder(null)
    setShowForm(true)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formInitial: OrderFormData = editingOrder
    ? {
        order_date:    editingOrder.order_date,
        confirmed:     editingOrder.confirmed,
        time_text:     editingOrder.time_text ?? '',
        table_no:      editingOrder.table_no ?? '',
        customer_name: editingOrder.customer_name ?? '',
        unit_price:    editingOrder.unit_price,
        quantity:      editingOrder.quantity,
        adjustments:   editingOrder.adjustments ?? [],
        phone:         editingOrder.phone ?? '',
        note:          editingOrder.note ?? '',
        menu_id:       editingOrder.menu_id,
      }
    : blankForm(currentDate)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <span className="text-base font-medium">訂位管理</span>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">‹</button>
          <span className="text-sm font-medium min-w-[140px] text-center">{fmtDate(currentDate)}</span>
          <button onClick={() => changeDate(1)}  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">›</button>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {profile?.name}
          <button onClick={handleLogout} className="hover:text-gray-900">登出</button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '訂單數', value: filtered.length },
          { label: '已確認', value: `${confirmedCnt} / ${filtered.length}` },
          { label: '總金額', value: fmtMoney(totalAmount) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-xl font-medium">{value}</div>
          </div>
        ))}
      </div>

      {/* action bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <input
          placeholder="搜尋姓名或電話…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
        />
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(filtered, currentDate)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100"
          >匯出 CSV</button>
          <button
            onClick={startAdd}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700"
          >＋ 新增訂單</button>
        </div>
      </div>

      {/* form */}
      {showForm && (
        <div className="mb-4">
          <OrderForm
            initial={formInitial}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingOrder(null) }}
          />
        </div>
      )}

      {/* list */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">載入中…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {search ? '找不到符合的訂單' : '這天還沒有訂單，點「新增訂單」開始建立'}
          </div>
        ) : filtered.map(order => (
          <OrderRow
            key={order.id}
            order={order}
            onToggle={() => handleToggle(order)}
            onEdit={() => startEdit(order)}
            onDelete={() => handleDelete(order)}
          />
        ))}
      </div>

    </div>
  )
}
