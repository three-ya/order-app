'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderFormData, Adjustment, OrderMenuItem, Profile, Menu, MenuItem } from '@/lib/types'

const WEEKDAYS = ['日','一','二','三','四','五','六']
function toLocalDate(d: Date) { return d.toLocaleDateString('sv-SE') }
function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${d.getMonth()+1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`
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

function exportCSV(orders: Order[], date: string) {
  const headers = ['確認','時間','桌位','姓名','單價','數量','菜色','調整','總計','電話','備註']
  const rows = orders.map(o => {
    const menuText = (o.order_menu??[]).map(i=>`${i.name}${i.qty>1?'×'+i.qty:''}${i.price?'($'+i.price+')':''}${i.note?'['+i.note+']':''}`).join('、')
    const adjText  = (o.adjustments??[]).map(a=>`${a.name}:${a.amount}`).join(';')
    return [o.confirmed?'✓':'',o.time_text??'',o.table_no??'',o.customer_name??'',
      o.unit_price,o.quantity,menuText,adjText,orderTotal(o),o.phone??'',o.note??'']
  })
  const csv = [headers,...rows].map(r=>r.map(c=>{const s=String(c);return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\n')
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'),{href:url,download:`訂單_${date}.csv`})
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
}

function OrderMenuSection({ menuId, menuType, value, onChange }: {
  menuId: string|null; menuType: string; value: OrderMenuItem[]; onChange: (v: OrderMenuItem[]) => void
}) {
  const supabase = createClient()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const isDandan = menuType === '單點'

  useEffect(() => {
    if (!menuId) { setMenuItems([]); return }
    supabase.from('menu_items').select('*').eq('menu_id', menuId)
      .order('sort_order').then(({ data }) => setMenuItems((data as MenuItem[])??[]))
  }, [menuId])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = search ? menuItems.filter(i=>i.name.includes(search)) : menuItems
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
  const subtotal = value.reduce((s,i)=>s+(i.price??0)*(i.qty??1),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-gray-500">{isDandan?'點餐清單':'本次菜色（可調整）'}</label>
        {isDandan && subtotal>0 && <span className="text-xs font-medium">{fmtMoney(subtotal)}</span>}
      </div>
      {value.map((item,idx) => (
        <div key={idx} className="flex gap-1.5 items-center mb-1.5">
          <span className="text-xs text-gray-300 w-4 text-right shrink-0">{idx+1}</span>
          <input className="flex-1 !py-1 text-sm" value={item.name}
            onChange={e=>update(idx,'name',e.target.value)} placeholder="菜色名稱" />
          {isDandan && <>
            <input type="number" min={1} className="w-12 !py-1 text-center text-sm"
              value={item.qty} onChange={e=>update(idx,'qty',parseInt(e.target.value)||1)} />
            <input type="number" min={0} className="w-20 !py-1 text-right text-sm"
              value={item.price||''} onChange={e=>update(idx,'price',parseInt(e.target.value)||0)} placeholder="金額" />
          </>}
          <input className="w-20 !py-1 text-xs" value={item.note}
            onChange={e=>update(idx,'note',e.target.value)} placeholder="備註" />
          <button type="button" onClick={()=>remove(idx)}
            className="text-gray-300 hover:text-red-400 text-lg px-1 leading-none shrink-0">×</button>
        </div>
      ))}
      {isDandan && value.length>0 && (
        <div className="text-right text-xs text-gray-400 mb-2">
          {value.filter(i=>i.price>0).length} 道有標價・合計 {fmtMoney(subtotal)}
        </div>
      )}
      <div className="flex gap-2 flex-wrap mt-2">
        <div className="relative" ref={pickerRef}>
          <button type="button" onClick={()=>setShowPicker(p=>!p)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">從菜單加菜</button>
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
                        {item.price>0 ? fmtMoney(item.price) : (item.note||'時價')}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {Object.keys(grouped).length===0 && <p className="p-3 text-sm text-gray-400">找不到</p>}
            </div>
          )}
        </div>
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
  const add = () => onChange([...value,{name:'',amount:0}])
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

  function set(field: keyof OrderFormData, value: unknown) {
    setForm(f=>({...f,[field]:value}))
  }

  async function handleMenuChange(menuId: string|null) {
    set('menu_id', menuId)
    const menu = menus.find(m=>m.id===menuId)??null
    setSelectedMenu(menu)
    if (menu) {
      if (menu.menu_type==='合菜' && menu.price) set('unit_price', menu.price)
      if (menu.menu_type==='單點') set('unit_price', 0)
      if (form.order_menu.length===0) {
        const { data } = await supabase.from('menu_items').select('*').eq('menu_id', menuId!).order('sort_order')
        set('order_menu', ((data as MenuItem[])??[]).map(i=>({name:i.name,price:i.price,qty:1,note:''})))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const timeText = timePeriod?(timeSpecific?`${timePeriod} ${timeSpecific}`:timePeriod):''
    await onSave({...form, time_text:timeText})
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      {menus.length>0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">套餐</label>
          <select value={form.menu_id??''} onChange={e=>handleMenuChange(e.target.value||null)}>
            <option value="">不選套餐</option>
            {menus.map(m=>(
              <option key={m.id} value={m.id}>
                {m.name}{m.menu_type==='合菜'&&m.price?`（$${m.price.toLocaleString()}/桌）`:''}
              </option>
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
        {(!selectedMenu||selectedMenu.menu_type!=='單點') && <>
          <div>
            <label className="text-xs text-gray-500 block mb-1">單價</label>
            <input type="number" placeholder="4000" value={form.unit_price||''} onChange={e=>set('unit_price',parseInt(e.target.value)||0)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">數量（桌）</label>
            <input type="number" min={1} value={form.quantity} onChange={e=>set('quantity',parseInt(e.target.value)||1)} />
          </div>
        </>}
        <div className={selectedMenu?.menu_type==='單點'?'col-span-2 sm:col-span-4':'col-span-2'}>
          <label className="text-xs text-gray-500 block mb-1">電話</label>
          <input placeholder="0912345678" value={form.phone} onChange={e=>set('phone',e.target.value)} />
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
            value={form.order_menu} onChange={v=>set('order_menu',v)} />
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

function OrderRow({ order, onToggle, onEdit, onDelete, onQuickUpdate }: {
  order: Order; onToggle: ()=>void; onEdit: ()=>void; onDelete: ()=>void
  onQuickUpdate: (p:{table_no:string|null})=>void
}) {
  const adjs  = order.adjustments??[]
  const om    = order.order_menu??[]
  const total = orderTotal(order)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [editingTable, setEditingTable]   = useState(false)
  const [tableVal, setTableVal]           = useState(order.table_no??'')

  useEffect(()=>{setTableVal(order.table_no??'')},[order.table_no])

  function saveTable() {
    const next = tableVal.trim()||null
    if (next!==(order.table_no??null)) onQuickUpdate({table_no:next})
    setEditingTable(false)
  }

  return (
    <div className={`grid grid-cols-[28px_1fr_100px_64px] gap-3 px-4 py-3 border-b border-gray-100 last:border-0 items-start ${!order.confirmed?'opacity-60':''}`}>
      <button onClick={onToggle}
        className={`w-[22px] h-[22px] rounded-full border mt-0.5 flex items-center justify-center text-xs shrink-0 ${order.confirmed?'bg-green-50 border-green-400 text-green-600':'border-gray-300 text-transparent hover:border-gray-500'}`}>✓</button>
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
        </div>
        {(order.phone||order.note) && (
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            {order.phone && <span>📞 {order.phone}</span>}
            {order.note && <span className="whitespace-pre-wrap">📝 {order.note}</span>}
          </div>
        )}
        {showBreakdown && om.length>0 && (
          <div className="mt-2 space-y-0.5">
            {om.map((i,idx)=>(
              <div key={idx} className="text-xs text-gray-500 flex gap-2">
                <span className="text-gray-300 shrink-0">{idx+1}.</span>
                <span className="flex-1">{i.name}{i.qty>1?` ×${i.qty}`:''}</span>
                {i.price>0 && <span className="text-gray-400 shrink-0">{fmtMoney(i.price*i.qty)}</span>}
                {i.note && <span className="text-gray-400">[{i.note}]</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-right cursor-pointer select-none" onClick={()=>setShowBreakdown(b=>!b)} title="點擊展開明細">
        {showBreakdown ? (
          <>
            {order.unit_price>0 && <div className="text-xs text-gray-400 font-mono">{order.unit_price.toLocaleString()} × {order.quantity}</div>}
            {adjs.map((a,i)=>(
              <div key={i} className={`text-xs font-mono ${a.amount<0?'text-red-400':'text-gray-400'}`}>
                {a.amount>=0?'+':'−'} {fmtMoney(a.amount)}
              </div>
            ))}
            <div className="text-sm font-medium mt-0.5 text-blue-600 underline decoration-dotted">{fmtMoney(total)}</div>
          </>
        ) : (
          <div className="text-sm font-medium underline decoration-dotted text-gray-700">{fmtMoney(total)}</div>
        )}
        {om.length>0 && <div className="text-xs text-gray-300 mt-0.5">{om.length} 道菜</div>}
      </div>
      <div className="flex justify-end gap-1 pt-0.5">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">✏️</button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">🗑</button>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [currentDate,setCurrentDate]   = useState(toLocalDate(new Date()))
  const [orders,setOrders]             = useState<Order[]>([])
  const [menus,setMenus]               = useState<Menu[]>([])
  const [profile,setProfile]           = useState<Profile|null>(null)
  const [loading,setLoading]           = useState(true)
  const [search,setSearch]             = useState('')
  const [periodFilter,setPeriodFilter] = useState<'全部'|'中午'|'晚上'>('全部')
  const [showForm,setShowForm]         = useState(false)
  const [editingOrder,setEditingOrder] = useState<Order|null>(null)

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if (!user) return
      supabase.from('profiles').select('*').eq('id',user.id).single().then(({data})=>setProfile(data))
    })
    supabase.from('menus').select('*').order('price',{ascending:true})
      .then(({data})=>setMenus((data as Menu[])??[]))
  },[])

  const fetchOrders = useCallback(async()=>{
    setLoading(true)
    const {data} = await supabase.from('orders').select('*,profiles(id,name,role)')
      .eq('order_date',currentDate).order('created_at',{ascending:true})
    setOrders((data as Order[])??[])
    setLoading(false)
  },[currentDate])

  useEffect(()=>{fetchOrders()},[fetchOrders])
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

  function changeDate(delta:number){
    const d=new Date(currentDate+'T00:00:00');d.setDate(d.getDate()+delta);setCurrentDate(toLocalDate(d))
  }
  async function handleSave(data:OrderFormData){
    const {user}=(await supabase.auth.getUser()).data;if(!user)return
    const payload={...data,created_by:user.id}
    if(editingOrder) await supabase.from('orders').update(payload).eq('id',editingOrder.id)
    else             await supabase.from('orders').insert(payload)
    setShowForm(false);setEditingOrder(null);fetchOrders()
  }
  async function handleToggle(o:Order){await supabase.from('orders').update({confirmed:!o.confirmed}).eq('id',o.id);fetchOrders()}
  async function handleDelete(o:Order){
    if(!confirm(`確定刪除「${o.customer_name??o.table_no}」？`))return
    await supabase.from('orders').delete().eq('id',o.id);fetchOrders()
  }
  async function handleQuickUpdate(o:Order,patch:{table_no:string|null}){
    await supabase.from('orders').update(patch).eq('id',o.id);fetchOrders()
  }
  async function handleLogout(){await supabase.auth.signOut();router.push('/login')}

  const formInitial:OrderFormData = editingOrder?{
    order_date:editingOrder.order_date, confirmed:editingOrder.confirmed,
    time_text:editingOrder.time_text??'', table_no:editingOrder.table_no??'',
    customer_name:editingOrder.customer_name??'', unit_price:editingOrder.unit_price,
    quantity:editingOrder.quantity, adjustments:editingOrder.adjustments??[],
    order_menu:editingOrder.order_menu??[], phone:editingOrder.phone??'',
    note:editingOrder.note??'', menu_id:editingOrder.menu_id,
  }:blankForm(currentDate)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <span className="text-base font-medium">訂位管理</span>
        <div className="flex items-center gap-2">
          <button onClick={()=>changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">‹</button>
          <span className="text-sm font-medium min-w-[140px] text-center">{fmtDate(currentDate)}</span>
          <button onClick={()=>changeDate(1)}  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">›</button>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {profile?.name}
          <Link href="/menus" className="hover:text-gray-900">菜單管理</Link>
          <button onClick={handleLogout} className="hover:text-gray-900">登出</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[{label:'訂單數',value:filtered.length},{label:'已確認',value:`${confirmedCnt} / ${filtered.length}`},{label:'總金額',value:fmtMoney(totalAmount)}]
          .map(({label,value})=>(
            <div key={label} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <div className="text-xl font-medium">{value}</div>
            </div>
          ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input placeholder="搜尋姓名或電話…" value={search} onChange={e=>setSearch(e.target.value)} className="w-40" />
          <div className="flex gap-1">
            {(['全部','中午','晚上'] as const).map(p=>(
              <button key={p} onClick={()=>setPeriodFilter(p)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${periodFilter===p?'bg-gray-900 text-white border-gray-900':'bg-white border-gray-200 hover:bg-gray-100'}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>exportCSV(filtered,currentDate)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">匯出 CSV</button>
          <button onClick={()=>{setEditingOrder(null);setShowForm(true)}}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700">＋ 新增訂單</button>
        </div>
      </div>

      {showForm && (
        <div className="mb-4">
          <OrderForm initial={formInitial} menus={menus} onSave={handleSave}
            onCancel={()=>{setShowForm(false);setEditingOrder(null)}} />
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {loading ? <div className="py-12 text-center text-sm text-gray-400">載入中…</div>
        : filtered.length===0 ? <div className="py-12 text-center text-sm text-gray-400">{search?'找不到符合的訂單':'這天還沒有訂單'}</div>
        : filtered.map(order=>(
          <OrderRow key={order.id} order={order}
            onToggle={()=>handleToggle(order)}
            onEdit={()=>{setEditingOrder(order);setShowForm(true)}}
            onDelete={()=>handleDelete(order)}
            onQuickUpdate={patch=>handleQuickUpdate(order,patch)} />
        ))}
      </div>
    </div>
  )
}
