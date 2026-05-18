'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Menu, MenuItem } from '@/lib/types'

function toCardTitle(name: string): string {
  const m = name.match(/(\d+)元/)
  if (m) return `${parseInt(m[1]).toLocaleString()} 元(10 人)`
  return name
}

export default function MenuPrintPage() {
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [title,  setTitle]  = useState('')
  const [rawDishes, setRawDishes] = useState('') // textarea value: one dish per line
  const [ready,  setReady]  = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('menus').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*').eq('menu_id', id).order('sort_order'),
    ]).then(([{ data: m }, { data: mi }]) => {
      if (m)  setTitle(toCardTitle((m as Menu).name))
      if (mi) setRawDishes((mi as MenuItem[]).map(i => i.name).join('\n'))
      setReady(true)
    })
  }, [id])

  const dishes = rawDishes.split('\n').filter(d => d.trim() !== '')

  if (!ready) return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', fontSize: '14px' }}>載入中…</div>
  )

  const CARDS = 6

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          body { margin: 0; }
          .preview-bg { padding: 0 !important; background: white !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: #fff; }

        /* A4 紙 */
        .a4 {
          width: 210mm;
          height: 297mm;
          background: white;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(2, 1fr);
        }
        .card {
          border: 0.5px solid #888;
          padding: 8mm 6mm 4mm;
          overflow: hidden;
        }
        .card-title {
          font-family: '標楷體', 'DFKai-SB', 'BiauKai', 'Noto Serif TC', serif;
          font-size: 15pt;
          font-weight: bold;
          line-height: 1.4;
          margin: 0 0 3mm 0;
        }
        .card-divider {
          border: none;
          border-top: 0.5px solid #555;
          margin: 0 0 3mm 0;
        }
        .dish {
          font-family: '標楷體', 'DFKai-SB', 'BiauKai', 'Noto Serif TC', serif;
          font-size: 12pt;
          line-height: 1.85;
          margin: 0;
        }
      `}</style>

      {/* 頂部按鈕列 */}
      <div className="no-print" style={{
        padding: '8px 14px', display: 'flex', gap: '8px', alignItems: 'center',
        background: '#f5f5f5', borderBottom: '1px solid #ddd',
      }}>
        <button onClick={() => window.print()}
          style={{ padding:'6px 18px', background:'#111', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>
          🖨 列印
        </button>
        <button onClick={() => window.close()}
          style={{ padding:'6px 14px', background:'#fff', border:'1px solid #ccc', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>
          關閉
        </button>
        <span style={{ fontSize:'12px', color:'#999', marginLeft:'4px' }}>
          A4 · 3欄 × 2列 · 共 6 格
        </span>
      </div>

      {/* 主體：左側編輯，右側預覽 */}
      <div style={{ display:'flex', height:'calc(100vh - 45px)', overflow:'hidden' }}>

        {/* 左側編輯面板 */}
        <div className="no-print" style={{
          width: '240px', minWidth: '240px',
          borderRight: '1px solid #e0e0e0',
          overflow: 'auto',
          padding: '14px 12px',
          background: '#fafafa',
        }}>
          <div style={{ fontSize:'12px', fontWeight:'600', color:'#555', marginBottom:'10px', letterSpacing:'0.5px' }}>
            編輯內容
          </div>

          {/* 標題 */}
          <div style={{ marginBottom:'14px' }}>
            <label style={{ display:'block', fontSize:'11px', color:'#888', marginBottom:'4px' }}>
              標題
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width:'100%', padding:'6px 8px',
                border:'1px solid #ddd', borderRadius:'6px',
                fontSize:'13px',
                fontFamily:'"標楷體","DFKai-SB",serif',
              }}
            />
          </div>

          {/* 菜色（每行一道） */}
          <div>
            <label style={{ display:'block', fontSize:'11px', color:'#888', marginBottom:'4px' }}>
              菜色（每行一道）
            </label>
            <textarea
              value={rawDishes}
              onChange={e => setRawDishes(e.target.value)}
              rows={18}
              style={{
                width:'100%', padding:'6px 8px',
                border:'1px solid #ddd', borderRadius:'6px',
                fontSize:'13px', lineHeight:'1.8',
                fontFamily:'"標楷體","DFKai-SB",serif',
                resize:'vertical',
              }}
            />
            <div style={{ fontSize:'11px', color:'#bbb', marginTop:'4px' }}>
              共 {dishes.length} 道
            </div>
          </div>
        </div>

        {/* 右側 A4 預覽 */}
        <div className="preview-bg" style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          background: '#e8e8e8',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}>
          <div className="a4">
            {Array.from({ length: CARDS }).map((_, ci) => (
              <div key={ci} className="card">
                <div className="card-title">{title}</div>
                <hr className="card-divider" />
                {dishes.map((d, di) => (
                  <div key={di} className="dish">{d}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
