'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import type { Order, OrderFormData, Adjustment, OrderMenuItem, Profile, Menu, MenuItem } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────
const WEEKDAYS = ['日','一','二','三','四','五','六']
function toLocalDate(d: Date) { return d.toLocaleDateString('sv-SE') }
function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${d.getMonth()+1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`
}
function fmtDateShort(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${d.getMonth()+1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`
}
function fmtMoney(n: number) { return '$' + Math.abs(Math.round(n)).toLocaleString() }
function parseTimeText(t: string|null): { period: string; specific: string } {
  if (!t) return { period:'', specific:'' }
  if (t.startsWith('中午')) return { period:'中午', specific:t.slice(2).trim() }
  if (t.startsWith('晚上')) return { period:'晚上', specific:t.slice(2).trim() }
  return { period:'晚上', specific:t.trim() }
}
function orderTotal(o: Order) {
  const main = (o.unit_price??0)*(o.quantity??1)
  const menu = (o.order_menu??[]).reduce((s,i)=>s+(i.price??0)*(i.qty??1),0)
  const adj  = (o.adjustments??[]).reduce((s,a)=>s+(a.amount??0),0)
  return main+menu+adj
}
function blankForm(date: string): OrderFormData {
  return { order_date:date, confirmed:false, time_text:'', table_no:'',
    customer_name:'', unit_price:0, quantity:1, adjustments:[], order_menu:[], phone:'', note:'', menu_id:null }
}

const MENU_GROUP_ORDER = ['合菜','旅行社','喜宴','單點','其他']
function getMenuGroup(name: string): string {
  for (const g of MENU_GROUP_ORDER) { if (name.startsWith(g)) return g }
  return '其他'
}

function exportCSV(orders: Order[], date: string) {
  const headers = ['確認','時間','桌位','姓名','單價','數量','菜色','調整','總計','電話','備註']
  const rows = orders.map(o => {
    const menuText = (o.order_menu??[]).map(i=>`${i.name}${i.qty>1?'x'+i.qty:''}${i.price?'($'+i.price+')':''}${i.note?'['+i.note+']':''}`).join('、')
    const adjText  = (o.adjustments??[]).map(a=>`${a.name}:${a.amount}`).join(';')
    return [o.confirmed?'V':'',o.time_text??'',o.table_no??'',o.customer_name??'',
      o.unit_price,o.quantity,menuText,adjText,orderTotal(o),o.phone??'',o.note??'']
  })
  const csv = [headers,...rows].map(r=>r.map(c=>{
    const s=String(c); return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s
  }).join(',')).join('\n')
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'),{href:url,download:`訂單_${date}.csv`})
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
}

// ─── HistorySearch ──────────────────────────────────────────────
function HistorySearch({ onClose, onCopy, onRestore }: {
  onClose: () => void
  onCopy: (order: Order, date: string) => Promise<void>
  onRestore: (order: Order) => Promise<void>
}) {
  const supabase = createClient()
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<Order[]>([])
  const [searching, setSearching]   = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const t = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    clearTimeout(t.current)
    setSearching(true)
    t.current = setTimeout(async () => {
      let q = supabase.from('orders').select('*')
        .or(`customer_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('order_date', { ascending: false })
        .limit(30)
      if (!showDeleted) q = q.is('deleted_at', null)
      const { data } = await q
      setResults((data as Order[]) ?? [])
      setSearching(false)
    }, 400)
  }, [query, showDeleted])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl flex flex-col" style={{maxHeight:'85vh'}}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <i className="ti ti-history text-gray-400 text-lg" aria-hidden="true" />
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="搜尋姓名或電話…" className="flex-1" />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <input type="checkbox" id="show-del" checked={showDeleted} onChange={e=>setShowDeleted(e.target.checked)}
            className="w-4 h-4 cursor-pointer" />
          <label htmlFor="show-del" className="text-xs text-gray-500 cursor-pointer">包含已刪除的訂單</label>
        </div>
        <div className="overflow-y-auto flex-1">
          {searching && <div className="py-8 text-center text-sm text-gray-400">搜尋中…</div>}
          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">找不到符合的歷史訂單</div>
          )}
          {!searching && query.length < 2 && (
            <div className="py-8 text-center text-sm text-gray-400">輸入姓名或電話開始搜尋</div>
          )}
          {results.map(order => (
            <HistoryResult key={order.id} order={order} onCopy={onCopy} onRestore={onRestore} />
          ))}
        </div>
      </div>
    </div>
  )
}

function HistoryResult({ order, onCopy, onRestore }: {
  order: Order
  onCopy: (o: Order, date: string) => Promise<void>
  onRestore: (o: Order) => Promise<void>
}) {
  const [showDateInput, setShowDateInput] = useState(false)
  const [customDate, setCustomDate]       = useState(toLocalDate(new Date()))
  const [loading, setLoading]             = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const isDeleted = !!order.deleted_at

  async function handleCopy(date: string) {
    setLoading(true); await onCopy(order, date); setLoading(false)
  }
  async function handleRestore() {
    setLoading(true); await onRestore(order); setLoading(false)
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${isDeleted?'opacity-60':''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isDeleted && <span className="text-xs text-red-400 border border-red-200 rounded px-1.5 py-0.5">已刪除</span>}
          <span className={`font-medium text-sm ${isDeleted?'line-through':''}`}>{order.customer_name || '（未填）'}</span>
          {order.table_no && <span className="text-xs font-mono bg-gray-100 rounded px-1.5 py-0.5">{order.table_no}</span>}
        </div>
        <div className="text-xs text-gray-400 mt-0.5 flex gap-2 flex-wrap">
          <span>{fmtDateShort(order.order_date)}</span>
          {order.time_text && <span>{order.time_text}</span>}
          <span>{order.quantity} 桌</span>
          {order.phone && <span>📞 {order.phone}</span>}
        </div>
        {order.note && <div className="text-xs text-gray-400 mt-0.5 truncate">📝 {order.note}</div>}
      </div>
      <div className="shrink-0 flex flex-col gap-1.5">
        {isDeleted ? (
          <button onClick={handleRestore} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap">
            {loading?'還原中…':'還原'}
          </button>
        ) : (
          <>
            <button onClick={()=>handleCopy(toLocalDate(new Date()))} disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap">
              {loading?'複製中…':'複製到今天'}
            </button>
            <button onClick={()=>{ setShowDateInput(p=>!p); setTimeout(()=>dateRef.current?.showPicker?.(),50) }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 whitespace-nowrap">
              指定日期…
            </button>
            {showDateInput && (
              <div className="flex gap-1 items-center">
                <div style={{position:'relative'}}>
                  <button onClick={()=>dateRef.current?.showPicker?.()}
                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {fmtDateShort(customDate)}
                  </button>
                  <input ref={dateRef} type="date" value={customDate}
                    onChange={e=>{ if(e.target.value) setCustomDate(e.target.value) }}
                    className="sr-only" />
                </div>
                <button onClick={()=>handleCopy(customDate)} disabled={loading}
                  className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-50">複製</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── OrderMenuSection ───────────────────────────────────────────
function OrderMenuSection({ menuId, menuType, pickerMenuId, value, onChange }: {
  menuId: string|null; menuType: string; pickerMenuId: string|null
  value: OrderMenuItem[]; onChange: (v: OrderMenuItem[]) => void
}) {
  const supabase = createClient()
  const [pickerItems, setPickerItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const isDandan = menuType === '單點'

  useEffect(() => {
    if (!pickerMenuId) { setPickerItems([]); return }
    supabase.from('menu_items').select('*').eq('menu_id', pickerMenuId)
      .order('sort_order').then(({ data }) => setPickerItems((data as MenuItem[])??[]))
  }, [pickerMenuId])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = search ? pickerItems.filter(i=>i.name.includes(search)) : pickerItems
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category||'其他'
    if (!acc[cat]) acc[cat]=[]
    acc[cat].push(item); return acc
  }, {} as Record<string,MenuItem[]>)

  function addItem(item: MenuItem) { onChange([...value,{name:item.name,price:item.price,qty:1,note:''}]); setSearch('') }
  function addBlank() { onChange([...value,{name:'',price:0,qty:1,note:''}]) }
  function remove(idx: number) { onChange(value.filter((_,i)=>i!==idx)) }
  function update(idx: number, field: keyof OrderMenuItem, v: string|number) {
    const next=[...value]; next[idx]={...next[idx],[field]:v}; onChange(next)
  }
  const menuSubtotal = value.reduce((s,i)=>s+(i.price??0)*(i.qty??1),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-gray-500">{isDandan?'點餐清單':'本次菜色（可調整・加入單點菜有標價）'}</label>
        {menuSubtotal>0 && <span className="text-xs text-gray-500">{fmtMoney(menuSubtotal)}</span>}
      </div>
      {value.map((item,idx) => (
        <div key={idx} className="flex gap-1.5 items-center mb-1.5">
          <span className="text-xs text-gray-300 w-4 text-right shrink-0">{idx+1}</span>
          <input className="flex-1 !py-1 text-sm" value={item.name}
            onChange={e=>update(idx,'name',e.target.value)} placeholder="菜色名稱" />
          <input type="number" min={1} className="w-12 !py-1 text-center text-sm"
            value={item.qty} onChange={e=>update(idx,'qty',parseInt(e.target.value)||1)} />
          <input type="number" min={0} className="w-20 !py-1 text-right text-sm"
            value={item.price||''} onChange={e=>update(idx,'price',parseInt(e.target.value)||0)}
            placeholder={isDandan?'金額':'加價'} />
          <input className="w-20 !py-1 text-xs" value={item.note}
            onChange={e=>update(idx,'note',e.target.value)} placeholder="備註" />
          <button type="button" onClick={()=>remove(idx)}
            className="text-gray-300 hover:text-red-400 text-lg px-1 leading-none shrink-0">×</button>
        </div>
      ))}
      {isDandan && value.length>0 && (
        <div className="text-right text-xs text-gray-400 mb-2">
          {value.filter(i=>i.price>0).length} 道有標價・合計 {fmtMoney(menuSubtotal)}
        </div>
      )}
      <div className="flex gap-2 flex-wrap mt-2">
        {pickerMenuId && (
          <div className="relative" ref={pickerRef}>
            <button type="button" onClick={()=>setShowPicker(p=>!p)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              {isDandan?'從單點菜單加菜':'加入單點菜色'}
            </button>
            {showPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-72 max-h-80 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-white border-b border-gray-100">
                  <input autoFocus className="!py-1.5 text-sm" placeholder="搜尋菜色…"
                    value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                {Object.entries(grouped).map(([cat,items]) => (
                  <div key={cat}>
                    <div className="px-3 py-1 text-xs text-gray-400 font-medium bg-gray-50">{cat}</div>
                    {items.map(item => (
                      <button key={item.id} type="button"
                        onClick={()=>{addItem(item);setShowPicker(false)}}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-left gap-2">
                        <span className="flex-1">{item.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {item.price>0?fmtMoney(item.price):(item.note||'時價')}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {Object.keys(grouped).length===0 && <p className="p-3 text-sm text-gray-400">找不到</p>}
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={addBlank}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">手動輸入</button>
        {value.length>0 && (
          <button type="button" onClick={()=>onChange([])}
            className="text-sm text-gray-400 hover:text-red-400 px-2 py-1.5">清空</button>
        )}
      </div>
    </div>
  )
}

function AdjustmentsField({ value, onChange }: { value: Adjustment[]; onChange: (v: Adjustment[]) => void }) {
  const add    = () => onChange([...value,{name:'',amount:0}])
  const remove = (i: number) => onChange(value.filter((_,idx)=>idx!==i))
  const update = (i: number, field: keyof Adjustment, v: string|number) => {
    const next=[...value]; next[i]={...next[i],[field]:v}; onChange(next)
  }
  return (
    <div className="space-y-2">
      {value.map((adj,i) => (
        <div key={i} className="flex gap-2 items-center">
          <input className="flex-1" placeholder="名稱" value={adj.name} onChange={e=>update(i,'name',e.target.value)} />
          <input type="number" className="w-28" placeholder="金額" value={adj.amount||''}
            onChange={e=>update(i,'amount',parseInt(e.target.value)||0)} />
          <button type="button" onClick={()=>remove(i)}
            className="text-gray-400 hover:text-red-500 px-1 text-lg leading-none">×</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm text-gray-500 hover:text-gray-900">+ 新增調整項目</button>
    </div>
  )
}

// ─── OrderForm ──────────────────────────────────────────────────
function OrderForm({ initial, menus, onSave, onCancel }: {
  initial: OrderFormData; menus: Menu[]
  onSave: (data: OrderFormData) => Promise<void>; onCancel: () => void
}) {
  const supabase = createClient()
  const parsed = parseTimeText(initial.time_text)
  const [form, setForm]             = useState<OrderFormData>(initial)
  const [timePeriod, setTimePeriod] = useState(parsed.period)
  const [timeSpecific, setTimeSpecific] = useState(parsed.specific)
  const [saving, setSaving]         = useState(false)
  const [selectedMenu, setSelectedMenu] = useState<Menu|null>(menus.find(m=>m.id===initial.menu_id)??null)
  const [dandanMenuId, setDandanMenuId] = useState<string|null>(null)
  const formDateRef = useRef<HTMLInputElement>(null)

  // Phone autocomplete
  const [phoneSugg, setPhoneSugg]         = useState<{customer_name:string; phone:string}[]>([])
  const [showPhoneSugg, setShowPhoneSugg] = useState(false)
  const phoneTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    supabase.from('menus').select('id').eq('menu_type','單點').limit(1)
      .then(({ data }) => { if (data?.[0]) setDandanMenuId(data[0].id) })
  }, [])

  function set(field: keyof OrderFormData, value: unknown) {
    setForm(f=>({...f,[field]:value}))
  }

  function handlePhoneChange(value: string) {
    set('phone', value)
    clearTimeout(phoneTimeout.current)
    if (value.length >= 2) {
      phoneTimeout.current = setTimeout(async () => {
        const { data } = await supabase.from('orders')
          .select('customer_name, phone')
          .ilike('phone', `${value}%`)
          .is('deleted_at', null)
          .not('phone', 'is', null)
          .not('customer_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10)
        const seen = new Set<string>()
        const unique = (data ?? []).filter((d: {customer_name:string;phone:string}) => {
          if (!d.phone || seen.has(d.phone)) return false
          seen.add(d.phone); return true
        })
        setPhoneSugg(unique as {customer_name:string;phone:string}[])
        setShowPhoneSugg(unique.length > 0)
      }, 300)
    } else {
      setPhoneSugg([]); setShowPhoneSugg(false)
    }
  }

  async function handleMenuChange(menuId: string|null) {
    set('menu_id', menuId)
    const menu = menus.find(m=>m.id===menuId)??null
    setSelectedMenu(menu)
    if (menu) {
      if (menu.menu_type==='合菜' && menu.price) set('unit_price', menu.price)
      if (menu.menu_type==='單點') { set('unit_price', 0); set('order_menu', []); return }
      if (menu.menu_type==='合菜' && form.order_menu.length===0) {
        const { data } = await supabase.from('menu_items').select('*').eq('menu_id', menuId!).order('sort_order')
        set('order_menu', ((data as MenuItem[])??[]).map(i=>({name:i.name,price:0,qty:1,note:''})))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const timeText = timePeriod?(timeSpecific?`${timePeriod} ${timeSpecific}`:timePeriod):''
    await onSave({...form, time_text:timeText})
    setSaving(false)
  }

  const menuGrouped = MENU_GROUP_ORDER.reduce((acc, group) => {
    const items = menus.filter(m => getMenuGroup(m.name) === group)
    if (items.length > 0) acc[group] = items
    return acc
  }, {} as Record<string, Menu[]>)

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">

      {/* 訂位日期（可以改日期） */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">訂位日期</label>
        <div style={{position:'relative', display:'inline-block'}}>
          <button type="button"
            onClick={()=>{ try{formDateRef.current?.showPicker()}catch{formDateRef.current?.focus()} }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors bg-white">
            <i className="ti ti-calendar text-gray-400 text-sm" aria-hidden="true" />
            <span className="text-sm font-medium">{fmtDate(form.order_date)}</span>
            <i className="ti ti-pencil text-gray-300 text-xs" aria-hidden="true" />
          </button>
          <input ref={formDateRef} type="date" value={form.order_date}
            onChange={e=>{ if(e.target.value) set('order_date', e.target.value) }}
            className="sr-only" />
        </div>
      </div>

      {/* 套餐選單（含分組） */}
      {menus.length>0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">套餐</label>
          <select value={form.menu_id??''} onChange={e=>handleMenuChange(e.target.value||null)}>
            <option value="">不選套餐</option>
            {Object.entries(menuGrouped).map(([group, groupMenus]) => (
              <optgroup key={group} label={group}>
                {groupMenus.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.menu_type==='合菜'&&m.price?`（$${m.price.toLocaleString()}/桌）`:''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">桌位</label>
          <input placeholder="A6A7" value={form.table_no} onChange={e=>set('table_no',e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-gray-500 block mb-1">時間</label>
          <div className="flex gap-1.5 items-center flex-wrap">
            {['中午','晚上'].map(p=>(
              <button key={p} type="button"
                onClick={()=>setTimePeriod(prev=>prev===p?'':p)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${timePeriod===p?'bg-gray-900 text-white border-gray-900':'bg-white border-gray-200 hover:bg-gray-100'}`}>{p}</button>
            ))}
            {timePeriod && <input className="w-20 !py-1.5" placeholder="6:30" value={timeSpecific} onChange={e=>setTimeSpecific(e.target.value)} />}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 block mb-1">客戶姓名</label>
          <input placeholder="王先生" value={form.customer_name??''} onChange={e=>set('customer_name',e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">單價{selectedMenu?' (可修改)':''}</label>
          <input type="number" placeholder="4000" value={form.unit_price||''}
            onChange={e=>set('unit_price',parseInt(e.target.value)||0)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">數量（桌）</label>
          <input type="number" min={1} value={form.quantity} onChange={e=>set('quantity',parseInt(e.target.value)||1)} />
        </div>
        {/* 電話 + 自動完成 */}
        <div className="col-span-2" style={{position:'relative'}}>
          <label className="text-xs text-gray-500 block mb-1">電話</label>
          <input placeholder="0912345678" value={form.phone}
            onChange={e=>handlePhoneChange(e.target.value)}
            onFocus={()=>phoneSugg.length>0&&setShowPhoneSugg(true)}
            onBlur={()=>setTimeout(()=>setShowPhoneSugg(false),200)}
            autoComplete="off" />
          {showPhoneSugg && phoneSugg.length>0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
              {phoneSugg.map((s,i) => (
                <button key={i} type="button"
                  onMouseDown={()=>{set('phone',s.phone);set('customer_name',s.customer_name);setShowPhoneSugg(false)}}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left">
                  <div>
                    <div className="text-sm font-medium">{s.customer_name}</div>
                    <div className="text-xs text-gray-400">{s.phone}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className="text-xs text-gray-500 block mb-1">備註</label>
          <textarea placeholder="特殊需求、座位安排…" value={form.note}
            onChange={e=>set('note',e.target.value)} rows={2} style={{resize:'vertical'}} />
        </div>
      </div>

      {form.menu_id && (
        <div className="border-t border-gray-200 pt-4">
          <OrderMenuSection menuId={form.menu_id} menuType={selectedMenu?.menu_type??'合菜'}
            pickerMenuId={dandanMenuId} value={form.order_menu} onChange={v=>set('order_menu',v)} />
        </div>
      )}
      <div className="border-t border-gray-200 pt-4">
        <label className="text-xs text-gray-500 block mb-2">調整項目（扣抵填負數）</label>
        <AdjustmentsField value={form.adjustments} onChange={v=>set('adjustments',v)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">取消</button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
          {saving?'儲存中…':'儲存'}
        </button>
      </div>
    </form>
  )
}

// ─── OrderRow ───────────────────────────────────────────────────
function OrderRow({ order, showAmounts, onToggle, onEdit, onDelete, onQuickUpdate }: {
  order: Order; showAmounts: boolean
  onToggle:()=>void; onEdit:()=>void; onDelete:()=>void
  onQuickUpdate:(p:{table_no?:string|null; quantity?:number})=>void
}) {
  const om    = order.order_menu??[]
  const total = orderTotal(order)
  const [editingTable, setEditingTable] = useState(false)
  const [tableVal, setTableVal]         = useState(order.table_no??'')
  const [editingQty, setEditingQty]     = useState(false)
  const [qtyVal, setQtyVal]             = useState(String(order.quantity??1))

  useEffect(()=>{setTableVal(order.table_no??'')},[order.table_no])
  useEffect(()=>{setQtyVal(String(order.quantity??1))},[order.quantity])

  function saveTable() {
    const next = tableVal.trim()||null
    if (next!==(order.table_no??null)) onQuickUpdate({table_no:next})
    setEditingTable(false)
  }
  function saveQty() {
    const next = parseInt(qtyVal)||1
    if (next!==order.quantity) onQuickUpdate({quantity:next})
    setEditingQty(false)
  }

  const gridCols = showAmounts ? '28px 1fr 100px 92px' : '28px 1fr 92px'

  return (
    <div style={{display:'grid',gridTemplateColumns:gridCols,gap:'12px',alignItems:'start'}}
      className={`px-4 py-3 border-b border-gray-100 last:border-0 ${!order.confirmed?'opacity-60':''}`}>
      <button onClick={onToggle}
        className={`w-[22px] h-[22px] rounded-full border mt-0.5 flex items-center justify-center text-xs shrink-0 ${
          order.confirmed?'bg-green-50 border-green-400 text-green-600':'border-gray-300 text-transparent hover:border-gray-500'}`}>V</button>
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {editingTable ? (
            <input autoFocus className="font-mono text-xs w-20 !py-0.5 !px-1.5 !rounded"
              value={tableVal} onChange={e=>setTableVal(e.target.value)} onBlur={saveTable}
              onKeyDown={e=>{if(e.key==='Enter')saveTable();if(e.key==='Escape'){setTableVal(order.table_no??'');setEditingTable(false)}}} />
          ) : (
            <span onClick={()=>setEditingTable(true)}
              className="font-mono text-xs bg-gray-100 border border-gray-200 rounded px-2 py-0.5 cursor-pointer hover:bg-gray-200 transition-colors">
              {order.table_no||<span className="text-gray-400 italic">桌次</span>}
            </span>
          )}
          {order.time_text && <span className="text-xs bg-blue-50 text-blue-600 rounded px-2 py-0.5">🕐 {order.time_text}</span>}
          <span className="font-medium text-sm">{order.customer_name||'（未填）'}</span>
          {editingQty ? (
            <input autoFocus type="number" min={1} className="w-12 !py-0.5 !px-1 text-center text-xs !rounded"
              value={qtyVal} onChange={e=>setQtyVal(e.target.value)} onBlur={saveQty}
              onKeyDown={e=>{if(e.key==='Enter')saveQty();if(e.key==='Escape')setEditingQty(false)}} />
          ) : (
            <span onClick={()=>setEditingQty(true)}
              className="text-xs border border-gray-200 rounded px-2 py-0.5 cursor-pointer hover:bg-gray-100 text-gray-500 transition-colors">
              {order.quantity} 桌
            </span>
          )}
        </div>
        {(order.phone||order.note) && (
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            {order.phone && <span>📞 {order.phone}</span>}
            {order.note && <span className="whitespace-pre-wrap">📝 {order.note}</span>}
          </div>
        )}
        {showAmounts && om.length>0 && (
          <div className="mt-2 space-y-0.5">
            {om.map((i,idx)=>(
              <div key={idx} className="text-xs text-gray-500 flex gap-2">
                <span className="text-gray-300 shrink-0">{idx+1}.</span>
                <span className="flex-1">{i.name}{i.qty>1?` x${i.qty}`:''}</span>
                {i.price>0&&<span className="text-gray-400 shrink-0">{fmtMoney(i.price*i.qty)}</span>}
                {i.note&&<span className="text-gray-400">[{i.note}]</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {showAmounts && (
        <div className="text-right">
          {order.unit_price>0 && <div className="text-xs text-gray-400 font-mono">{order.unit_price.toLocaleString()} x {order.quantity}</div>}
          {(order.adjustments??[]).map((a,i)=>(
            <div key={i} className={`text-xs font-mono ${a.amount<0?'text-red-400':'text-gray-400'}`}>
              {a.amount>=0?'+':'−'} {fmtMoney(a.amount)}
            </div>
          ))}
          <div className="text-sm font-medium mt-0.5">{fmtMoney(total)}</div>
          {om.length>0 && <div className="text-xs text-gray-300 mt-0.5">{om.length} 道菜</div>}
        </div>
      )}
      <div className="flex justify-end gap-1 pt-0.5">
        <button onClick={()=>window.open(`/print/${order.id}`,'_blank','width=420,height=700')}
          className="hidden sm:flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="列印">🖨</button>
        <button onClick={onEdit}   className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">✏️</button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">🗑</button>
      </div>
    </div>
  )
}

// ─── DeletedOrderRow ─────────────────────────────────────────────
function DeletedOrderRow({ order, onRestore }: { order: Order; onRestore: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 opacity-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-red-400">已刪除</span>
          <span className="text-sm line-through text-gray-500">{order.customer_name||'（未填）'}</span>
          {order.table_no && <span className="text-xs font-mono text-gray-400">{order.table_no}</span>}
          {order.time_text && <span className="text-xs text-gray-400">{order.time_text}</span>}
          <span className="text-xs text-gray-400">{order.quantity} 桌</span>
        </div>
      </div>
      <button onClick={onRestore}
        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0 text-gray-600">
        還原
      </button>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = createClient()
  const router   = useRouter()
  const dateInputRef = useRef<HTMLInputElement>(null)

  const [currentDate,setCurrentDate]     = useState(toLocalDate(new Date()))
  const [orders,setOrders]               = useState<Order[]>([])
  const [deletedOrders,setDeletedOrders] = useState<Order[]>([])
  const [menus,setMenus]                 = useState<Menu[]>([])
  const [profile,setProfile]             = useState<Profile|null>(null)
  const [loading,setLoading]             = useState(true)
  const [search,setSearch]               = useState('')
  const [periodFilter,setPeriodFilter]   = useState<'全部'|'中午'|'晚上'>('全部')
  const [showAmounts,setShowAmounts]     = useState(false)
  const [showDeleted,setShowDeleted]     = useState(false)
  const [showForm,setShowForm]           = useState(false)
  const [editingOrder,setEditingOrder]   = useState<Order|null>(null)
  const [historyOpen,setHistoryOpen]     = useState(false)
  const [pendingEditId,setPendingEditId] = useState<string|null>(null)

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if (!user) return
      supabase.from('profiles').select('*').eq('id',user.id).single()
        .then(({data})=>setProfile(data as Profile))
    })
    supabase.from('menus').select('*').order('menu_type').order('price',{ascending:true})
      .then(({data})=>setMenus((data as Menu[])??[]))
  },[])

  const fetchOrders = useCallback(async()=>{
    setLoading(true)
    const {data} = await supabase.from('orders').select('*,profiles(id,name,role)')
      .eq('order_date',currentDate).order('created_at',{ascending:true})
    const all = (data as Order[]) ?? []
    setOrders(all.filter(o => !o.deleted_at))
    setDeletedOrders(all.filter(o => !!o.deleted_at))
    setLoading(false)
  },[currentDate])

  useEffect(()=>{fetchOrders()},[fetchOrders])

  useEffect(()=>{
    if (!pendingEditId || orders.length===0) return
    const order = orders.find(o=>o.id===pendingEditId)
    if (order) { setEditingOrder(order); setShowForm(true); setPendingEditId(null); window.scrollTo({top:0,behavior:'smooth'}) }
  },[orders, pendingEditId])

  useEffect(()=>{
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},fetchOrders)
      .subscribe()
    return ()=>{supabase.removeChannel(ch)}
  },[fetchOrders])

  const filtered = orders.filter(o=>{
    if (search){const q=search.toLowerCase();if(!(o.customer_name??'').toLowerCase().includes(q)&&!(o.phone??'').includes(q))return false}
    if (periodFilter==='中午') return (o.time_text??'').startsWith('中午')
    if (periodFilter==='晚上') return (o.time_text??'').startsWith('晚上')
    return true
  })
  const totalAmount  = filtered.reduce((s,o)=>s+orderTotal(o),0)
  const confirmedCnt = filtered.filter(o=>o.confirmed).length

  function shiftDate(delta:number){
    const d=new Date(currentDate+'T00:00:00');d.setDate(d.getDate()+delta);setCurrentDate(toLocalDate(d))
  }
  async function handleLogout(){ await supabase.auth.signOut(); router.push('/login') }
  async function handleSave(data:OrderFormData){
    const {user}=(await supabase.auth.getUser()).data;if(!user)return
    const payload={...data,created_by:user.id}
    if(editingOrder) await supabase.from('orders').update(payload).eq('id',editingOrder.id)
    else             await supabase.from('orders').insert(payload)
    setShowForm(false);setEditingOrder(null);fetchOrders()
  }
  async function handleToggle(o:Order){
    await supabase.from('orders').update({confirmed:!o.confirmed}).eq('id',o.id);fetchOrders()
  }
  // 軟刪除
  async function handleDelete(o:Order){
    if(!confirm(`確定刪除「${o.customer_name??o.table_no}」？（可在列表底部還原）`))return
    await supabase.from('orders').update({deleted_at:new Date().toISOString()}).eq('id',o.id)
    fetchOrders()
  }
  async function handleRestore(o:Order){
    await supabase.from('orders').update({deleted_at:null}).eq('id',o.id)
    fetchOrders()
  }
  async function handleQuickUpdate(o:Order,patch:{table_no?:string|null;quantity?:number}){
    await supabase.from('orders').update(patch).eq('id',o.id);fetchOrders()
  }
  async function handleCopyOrder(sourceOrder: Order, targetDate: string) {
    const {user}=(await supabase.auth.getUser()).data;if(!user)return
    const { id: _id, created_at: _ca, updated_at: _ua, deleted_at: _da, profiles: _p, ...rest } = sourceOrder as Order & {created_at:string;updated_at:string;profiles?:unknown}
    const { data } = await supabase.from('orders').insert({
      ...rest, order_date:targetDate, confirmed:false, deleted_at:null, created_by:user.id
    }).select().single()
    if (data) {
      setPendingEditId(data.id); setHistoryOpen(false)
      if (currentDate===targetDate) fetchOrders(); else setCurrentDate(targetDate)
    }
  }

  const formInitial:OrderFormData = editingOrder?{
    order_date:editingOrder.order_date, confirmed:editingOrder.confirmed,
    time_text:editingOrder.time_text??'', table_no:editingOrder.table_no??'',
    customer_name:editingOrder.customer_name??'', unit_price:editingOrder.unit_price,
    quantity:editingOrder.quantity, adjustments:editingOrder.adjustments??[],
    order_menu:editingOrder.order_menu??[], phone:editingOrder.phone??'',
    note:editingOrder.note??'', menu_id:editingOrder.menu_id,
  }:blankForm(currentDate)

  return (
    <div className="pb-24">
      {/* 頂部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <span className="text-base font-medium">訂位管理</span>
        <div className="flex items-center gap-2">
          <button onClick={()=>shiftDate(-1)}
            className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xl text-gray-600">‹</button>
          <div style={{position:'relative'}}>
            <button onClick={()=>{ try{dateInputRef.current?.showPicker()}catch{dateInputRef.current?.focus()} }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <i className="ti ti-calendar text-gray-400 text-base" aria-hidden="true" />
              <span className="text-sm font-medium whitespace-nowrap">{fmtDate(currentDate)}</span>
            </button>
            <input ref={dateInputRef} type="date" value={currentDate}
              onChange={e=>{ if(e.target.value) setCurrentDate(e.target.value) }} className="sr-only" />
          </div>
          <button onClick={()=>shiftDate(1)}
            className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xl text-gray-600">›</button>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
          <Link href="/menus" className="hover:text-gray-900">菜單管理</Link>
          <span className="text-gray-300">|</span>
          <span className="text-gray-600">{profile?.name}</span>
          <button onClick={handleLogout} className="hover:text-gray-900 bg-transparent border-none cursor-pointer text-sm text-gray-500">登出</button>
        </div>
        <div className="sm:hidden w-16" />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 bg-white">
        {(['全部','中午','晚上'] as const).map(p=>(
          <button key={p} onClick={()=>setPeriodFilter(p)}
            className={`flex-1 py-3 text-sm transition-colors border-b-2 -mb-px ${
              periodFilter===p?'text-gray-900 font-medium border-gray-900':'text-gray-400 border-transparent hover:text-gray-600'}`}>
            {p}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-4">
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">訂單數</div>
            <div className="text-xl font-medium">{filtered.length}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">已確認</div>
            <div className="text-xl font-medium">{confirmedCnt} / {filtered.length}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 my-4 flex-wrap">
          <div className="relative">
            <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
            <input placeholder="搜尋今日…" value={search} onChange={e=>setSearch(e.target.value)} className="!pl-8 w-36" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setHistoryOpen(true)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center gap-1.5">
              <i className="ti ti-history text-sm" aria-hidden="true" />歷史
            </button>
            <button onClick={()=>setShowAmounts(s=>!s)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                showAmounts?'bg-gray-900 text-white border-gray-900':'border-gray-200 hover:bg-gray-100'}`}>
              {showAmounts?`今日 ${fmtMoney(totalAmount)}`:'顯示金額'}
            </button>
            <button onClick={()=>exportCSV(filtered,currentDate)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">匯出</button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4">
            <OrderForm initial={formInitial} menus={menus} onSave={handleSave}
              onCancel={()=>{setShowForm(false);setEditingOrder(null)}} />
          </div>
        )}

        {/* 訂單列表 */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-2">
          {loading
            ? <div className="py-12 text-center text-sm text-gray-400">載入中…</div>
            : filtered.length===0
              ? <div className="py-12 text-center text-sm text-gray-400">{search?'找不到符合的訂單':'這天還沒有訂單'}</div>
              : filtered.map(order=>(
                <OrderRow key={order.id} order={order} showAmounts={showAmounts}
                  onToggle={()=>handleToggle(order)}
                  onEdit={()=>{setEditingOrder(order);setShowForm(true)}}
                  onDelete={()=>handleDelete(order)}
                  onQuickUpdate={patch=>handleQuickUpdate(order,patch)} />
              ))
          }
        </div>

        {/* 已刪除的訂單（今天） */}
        {deletedOrders.length > 0 && (
          <div className="mb-4">
            <button
              onClick={()=>setShowDeleted(s=>!s)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-1"
            >
              <i className={`ti ${showDeleted?'ti-chevron-up':'ti-chevron-down'} text-xs`} aria-hidden="true" />
              已刪除 {deletedOrders.length} 筆
            </button>
            {showDeleted && (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mt-1">
                {deletedOrders.map(order=>(
                  <DeletedOrderRow key={order.id} order={order} onRestore={()=>handleRestore(order)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={()=>{ setEditingOrder(null); setShowForm(true); window.scrollTo({top:0,behavior:'smooth'}) }}
        className="fixed right-5 w-14 h-14 rounded-full bg-gray-900 text-white shadow-xl flex items-center justify-center hover:bg-gray-700 active:scale-95 transition-all z-20"
        style={{ bottom:'calc(64px + 20px)' }}
        title="新增訂單"
      >
        <i className="ti ti-plus text-2xl" aria-hidden="true" />
      </button>

      {historyOpen && (
        <HistorySearch
          onClose={()=>setHistoryOpen(false)}
          onCopy={handleCopyOrder}
          onRestore={handleRestore}
        />
      )}

      <BottomNav />
    </div>
  )
}
