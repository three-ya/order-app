'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Menu, MenuItem } from '@/lib/types'

export default function MenusPage() {
  const supabase = createClient()
  const [menus, setMenus]           = useState<Menu[]>([])
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [items, setItems]           = useState<MenuItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [menuEdit, setMenuEdit]     = useState<{name:string;price:string}|null>(null)
  const [editingItemId, setEditingItemId]   = useState<string|null>(null)
  const [editingItemName, setEditingItemName] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const newItemRef = useRef<HTMLInputElement>(null)

  async function fetchMenus() {
    const {data} = await supabase.from('menus').select('*').order('menu_type').order('price',{ascending:true})
    setMenus((data as Menu[])??[]); setLoading(false)
  }
  async function fetchItems(menuId:string) {
    const {data} = await supabase.from('menu_items').select('*').eq('menu_id',menuId).order('sort_order',{ascending:true})
    setItems((data as MenuItem[])??[])
  }

  useEffect(()=>{fetchMenus()},[])
  useEffect(()=>{ if(selectedId)fetchItems(selectedId); else setItems([]) },[selectedId])
  useEffect(()=>{ if(addingItem)newItemRef.current?.focus() },[addingItem])

  const selectedMenu = menus.find(m=>m.id===selectedId)

  // group items by category
  const groupedItems = items.reduce((acc,item)=>{
    const cat = item.category||''
    if (!acc[cat]) acc[cat]=[]
    acc[cat].push(item); return acc
  }, {} as Record<string,MenuItem[]>)

  async function addMenu(type:'合菜'|'單點') {
    const {data} = await supabase.from('menus')
      .insert({name:type==='合菜'?'新合菜菜單':'新單點菜單',price:0,is_default:false,menu_type:type})
      .select().single()
    await fetchMenus()
    if (data){setSelectedId(data.id);setMenuEdit({name:data.name,price:'0'})}
  }

  async function saveMenu() {
    if (!selectedId||!menuEdit) return
    await supabase.from('menus').update({name:menuEdit.name,price:parseInt(menuEdit.price)||0}).eq('id',selectedId)
    setMenuEdit(null); fetchMenus()
  }

  async function deleteMenu(id:string) {
    if (!confirm('確定刪除這份菜單？菜色也會一併刪除。'))return
    await supabase.from('menus').delete().eq('id',id)
    if (selectedId===id)setSelectedId(null); fetchMenus()
  }

  async function addItem() {
    if (!selectedId||!newItemName.trim())return
    const maxOrder = items.reduce((m,i)=>Math.max(m,i.sort_order),0)
    await supabase.from('menu_items').insert({menu_id:selectedId,name:newItemName.trim(),price:0,sort_order:maxOrder+1,category:null})
    setNewItemName('');setAddingItem(false);fetchItems(selectedId)
  }

  async function saveItem(item:MenuItem) {
    if (!editingItemName.trim())return
    await supabase.from('menu_items').update({name:editingItemName.trim()}).eq('id',item.id)
    setEditingItemId(null);if(selectedId)fetchItems(selectedId)
  }

  async function deleteItem(id:string) {
    await supabase.from('menu_items').delete().eq('id',id)
    if(selectedId)fetchItems(selectedId)
  }

  async function moveItem(item:MenuItem,dir:'up'|'down') {
    const idx=items.findIndex(i=>i.id===item.id)
    const swapIdx=dir==='up'?idx-1:idx+1
    if (swapIdx<0||swapIdx>=items.length)return
    const swap=items[swapIdx]
    await Promise.all([
      supabase.from('menu_items').update({sort_order:swap.sort_order}).eq('id',item.id),
      supabase.from('menu_items').update({sort_order:item.sort_order}).eq('id',swap.id),
    ])
    if(selectedId)fetchItems(selectedId)
  }

  const heji   = menus.filter(m=>m.menu_type==='合菜')
  const dandan = menus.filter(m=>m.menu_type==='單點')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="text-sm text-gray-400 hover:text-gray-700">← 返回訂單</Link>
          <span className="text-base font-medium">菜單管理</span>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>addMenu('合菜')}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">＋ 合菜菜單</button>
          <button onClick={()=>addMenu('單點')}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700">＋ 單點菜單</button>
        </div>
      </div>

      {loading ? <div className="py-12 text-center text-sm text-gray-400">載入中…</div> : (
        <div className="grid sm:grid-cols-[220px_1fr] gap-4 items-start">
          {/* menu list */}
          <div className="space-y-4">
            {heji.length>0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-2 px-1">合菜</div>
                <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
                  {heji.map(m=>(
                    <button key={m.id}
                      onClick={()=>{setSelectedId(m.id);setMenuEdit(null);setEditingItemId(null)}}
                      className={`shrink-0 text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${selectedId===m.id?'bg-gray-900 text-white border-gray-900':'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      <div className="font-medium">{m.name}</div>
                      {m.price>0&&<div className={`text-xs mt-0.5 ${selectedId===m.id?'text-gray-300':'text-gray-400'}`}>${m.price.toLocaleString()} / 桌</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {dandan.length>0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-2 px-1">單點</div>
                <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
                  {dandan.map(m=>(
                    <button key={m.id}
                      onClick={()=>{setSelectedId(m.id);setMenuEdit(null);setEditingItemId(null)}}
                      className={`shrink-0 text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${selectedId===m.id?'bg-gray-900 text-white border-gray-900':'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      <div className="font-medium">{m.name}</div>
                      <div className={`text-xs mt-0.5 ${selectedId===m.id?'text-gray-300':'text-gray-400'}`}>{items.length>0&&selectedId===m.id?`${items.length} 道`:'單點菜單'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {menus.length===0 && <p className="text-sm text-gray-400">還沒有菜單</p>}
          </div>

          {/* detail */}
          {selectedMenu ? (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                {menuEdit ? (
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <input className="flex-1 min-w-0" value={menuEdit.name}
                      onChange={e=>setMenuEdit(v=>v&&({...v,name:e.target.value}))} placeholder="菜單名稱" />
                    {selectedMenu.menu_type==='合菜' && (
                      <div className="flex items-center gap-1">
                        <input type="number" className="w-24" value={menuEdit.price}
                          onChange={e=>setMenuEdit(v=>v&&({...v,price:e.target.value}))} placeholder="每桌價格" />
                        <span className="text-sm text-gray-400 whitespace-nowrap">元 / 桌</span>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <button onClick={saveMenu} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">儲存</button>
                      <button onClick={()=>setMenuEdit(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-100">取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium">{selectedMenu.name}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${selectedMenu.menu_type==='單點'?'bg-orange-50 text-orange-600':'bg-blue-50 text-blue-600'}`}>{selectedMenu.menu_type}</span>
                      {selectedMenu.price>0 && <span className="ml-2 text-sm text-gray-400">${selectedMenu.price.toLocaleString()} / 桌</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => window.open(`/print/menu/${selectedMenu.id}`, '_blank')}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-100"
                        title="列印 A4 桌卡（6格）"
                      >🖨 列印</button>
                      <button onClick={()=>setMenuEdit({name:selectedMenu.name,price:String(selectedMenu.price)})}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-100">編輯</button>
                      <button onClick={()=>deleteMenu(selectedMenu.id)}
                        className="px-3 py-1.5 text-sm text-red-500 border border-red-100 rounded-lg hover:bg-red-50">刪除</button>
                    </div>
                  </>
                )}
              </div>

              {/* items — grouped by category for 單點, flat for 合菜 */}
              {selectedMenu.menu_type==='單點' ? (
                Object.entries(groupedItems).map(([cat,catItems])=>(
                  <div key={cat}>
                    {cat && <div className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">{cat}</div>}
                    {catItems.map((item,idx)=>(
                      <ItemRow key={item.id} item={item} idx={items.indexOf(item)} total={items.length}
                        isEditing={editingItemId===item.id} editingName={editingItemName}
                        onStartEdit={()=>{setEditingItemId(item.id);setEditingItemName(item.name)}}
                        onChangeName={setEditingItemName} onSave={()=>saveItem(item)}
                        onCancel={()=>setEditingItemId(null)}
                        onDelete={()=>deleteItem(item.id)}
                        onMove={dir=>moveItem(item,dir)} showPrice={true} />
                    ))}
                  </div>
                ))
              ) : (
                items.map((item,idx)=>(
                  <ItemRow key={item.id} item={item} idx={idx} total={items.length}
                    isEditing={editingItemId===item.id} editingName={editingItemName}
                    onStartEdit={()=>{setEditingItemId(item.id);setEditingItemName(item.name)}}
                    onChangeName={setEditingItemName} onSave={()=>saveItem(item)}
                    onCancel={()=>setEditingItemId(null)}
                    onDelete={()=>deleteItem(item.id)}
                    onMove={dir=>moveItem(item,dir)} showPrice={false} />
                ))
              )}

              {/* add */}
              <div className="px-4 py-3">
                {addingItem ? (
                  <div className="flex gap-2">
                    <input ref={newItemRef} className="flex-1 !py-1.5" placeholder="菜色名稱"
                      value={newItemName} onChange={e=>setNewItemName(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')addItem();if(e.key==='Escape'){setAddingItem(false);setNewItemName('')}}} />
                    <button onClick={addItem} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg">新增</button>
                    <button onClick={()=>{setAddingItem(false);setNewItemName('')}}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">取消</button>
                  </div>
                ) : (
                  <button onClick={()=>setAddingItem(true)} className="text-sm text-gray-400 hover:text-gray-700">＋ 新增菜色</button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-gray-400 bg-white border border-gray-100 rounded-xl">
              選取左側菜單來查看或編輯菜色
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, idx, total, isEditing, editingName, onStartEdit, onChangeName, onSave, onCancel, onDelete, onMove, showPrice }: {
  item: MenuItem; idx: number; total: number
  isEditing: boolean; editingName: string
  onStartEdit: ()=>void; onChangeName: (s:string)=>void
  onSave: ()=>void; onCancel: ()=>void
  onDelete: ()=>void; onMove: (dir:'up'|'down')=>void
  showPrice: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 group last:border-0">
      <span className="w-5 text-xs text-gray-300 text-right shrink-0">{idx+1}</span>
      {isEditing ? (
        <input autoFocus className="flex-1 !py-1" value={editingName} onChange={e=>onChangeName(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')onSave();if(e.key==='Escape')onCancel()}} onBlur={onSave} />
      ) : (
        <span className="flex-1 text-sm cursor-pointer hover:text-gray-500" onClick={onStartEdit}>{item.name}</span>
      )}
      {showPrice && item.price>0 && !isEditing && (
        <span className="text-xs text-gray-400 shrink-0">${item.price.toLocaleString()}</span>
      )}
      {item.note && !isEditing && (
        <span className="text-xs text-gray-300 shrink-0 max-w-[80px] truncate">{item.note}</span>
      )}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={()=>onMove('up')}   disabled={idx===0}       className="p-1 text-gray-300 hover:text-gray-600 disabled:invisible text-xs">↑</button>
        <button onClick={()=>onMove('down')} disabled={idx===total-1} className="p-1 text-gray-300 hover:text-gray-600 disabled:invisible text-xs">↓</button>
        <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-400 text-xs">✕</button>
      </div>
    </div>
  )
}
