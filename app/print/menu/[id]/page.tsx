'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Menu, MenuItem } from '@/lib/types'

export default function MenuPrintPage() {
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [menu,  setMenu]  = useState<Menu | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('menus').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*').eq('menu_id', id).order('sort_order'),
    ]).then(([{ data: m }, { data: mi }]) => {
      if (m)  setMenu(m as Menu)
      if (mi) setItems(mi as MenuItem[])
      setReady(true)
    })
  }, [id])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [ready])

  if (!menu) return <div style={{ padding:'20px', fontFamily:'sans-serif' }}>載入中…</div>

  const CARDS = 6  // A4 排 3x2 共 6 格

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        * { box-sizing: border-box; }
        body { background: #fff; margin: 0; }

        .a4 {
          width: 210mm;
          height: 297mm;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(2, 1fr);
          border: 0.5px solid #aaa;
          margin: 0 auto;
        }
        .card {
          border: 0.5px solid #aaa;
          padding: 7mm 5mm 5mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
        }
        .card-name {
          font-size: 15pt;
          font-weight: bold;
          text-align: center;
          letter-spacing: 1px;
          border-bottom: 1px solid #000;
          padding-bottom: 3mm;
          margin-bottom: 4mm;
          width: 100%;
          font-family: '標楷體', 'Noto Serif TC', serif;
        }
        .dish-list {
          list-style: none;
          margin: 0;
          padding: 0;
          text-align: center;
          width: 100%;
        }
        .dish-item {
          font-size: 12pt;
          line-height: 1.85;
          font-family: '標楷體', 'Noto Serif TC', serif;
        }
      `}</style>

      {/* 操作列（列印時隱藏） */}
      <div className="no-print" style={{
        padding:'10px 14px', display:'flex', gap:'8px',
        background:'#f5f5f5', borderBottom:'1px solid #ddd',
        position:'sticky', top:0,
      }}>
        <button
          onClick={() => window.print()}
          style={{ padding:'6px 16px', background:'#111', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}
        >🖨 列印（A4）</button>
        <button
          onClick={() => window.close()}
          style={{ padding:'6px 16px', background:'#fff', border:'1px solid #ccc', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}
        >關閉</button>
        <span style={{ fontSize:'12px', color:'#888', alignSelf:'center' }}>
          同一份菜單排 6 格，可剪開放桌上
        </span>
      </div>

      {/* A4 格線預覽 */}
      <div style={{ padding:'8px 0', background:'#eee', display:'flex', justifyContent:'center', minHeight:'calc(100vh - 44px)' }}>
        <div className="a4">
          {Array.from({ length: CARDS }).map((_, i) => (
            <div key={i} className="card">
              <div className="card-name">{menu.name}</div>
              <ul className="dish-list">
                {items.map((item, idx) => (
                  <li key={idx} className="dish-item">{item.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
