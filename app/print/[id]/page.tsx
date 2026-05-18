'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Menu } from '@/lib/types'

const WEEKDAYS = ['日','一','二','三','四','五','六']

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} (${WEEKDAYS[d.getDay()]})`
}

function orderTotal(o: Order) {
  const main = (o.unit_price??0) * (o.quantity??1)
  const menu = (o.order_menu??[]).reduce((s,i) => s + (i.price??0) * (i.qty??1), 0)
  const adj  = (o.adjustments??[]).reduce((s,a) => s + (a.amount??0), 0)
  return main + menu + adj
}

export default function PrintPage() {
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [order, setOrder] = useState<Order | null>(null)
  const [menu,  setMenu]  = useState<Menu  | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('orders').select('*, profiles(id,name,role)')
      .eq('id', id).single()
      .then(({ data }) => {
        if (!data) return
        setOrder(data as Order)
        if (data.menu_id) {
          supabase.from('menus').select('*').eq('id', data.menu_id).single()
            .then(({ data: m }) => { setMenu(m as Menu); setReady(true) })
        } else {
          setReady(true)
        }
      })
  }, [id])

  // 載入完成後自動觸發列印對話框
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [ready])

  if (!order) return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: '14px' }}>載入中…</div>
  )

  const total = orderTotal(order)
  const om    = order.order_menu ?? []

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm 2mm; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #fff; }
        .receipt {
          width: 74mm;
          margin: 0 auto;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11.5px;
          line-height: 1.6;
          color: #000;
        }
        .c  { text-align: center; }
        .b  { font-weight: bold; }
        .lg { font-size: 15px; }
        .sm { font-size: 10px; }
        .dash { border: none; border-top: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; }
        .row .l { flex: 1; }
        .row .r { text-align: right; white-space: nowrap; }
      `}</style>

      {/* 列印前的操作列（列印時隱藏）*/}
      <div className="no-print" style={{
        padding: '10px 14px', display: 'flex', gap: '8px',
        background: '#f5f5f5', borderBottom: '1px solid #ddd',
        position: 'sticky', top: 0,
      }}>
        <button
          onClick={() => window.print()}
          style={{ padding:'6px 16px', background:'#111', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}
        >🖨 列印</button>
        <button
          onClick={() => window.close()}
          style={{ padding:'6px 16px', background:'#fff', border:'1px solid #ccc', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}
        >關閉</button>
      </div>

      <div className="receipt" style={{ padding: '6px 4px 12px' }}>

        {/* 店名 */}
        <div className="c b lg" style={{ letterSpacing: '3px', margin: '4px 0 2px' }}>三 葉 餐 廳</div>
        <div className="c sm">TEL: 089-325261</div>
        <hr className="dash" />

        {/* 訂單基本資訊 */}
        {order.order_date && <div className="row"><span className="l">日期</span><span className="r">{fmtDate(order.order_date)}</span></div>}
        {order.time_text  && <div className="row"><span className="l">時間</span><span className="r">{order.time_text}</span></div>}
        {order.table_no   && <div className="row"><span className="l">桌位</span><span className="r">{order.table_no}</span></div>}
        {order.customer_name && <div className="row"><span className="l">客戶</span><span className="r">{order.customer_name}</span></div>}
        {order.phone && <div className="row"><span className="l">電話</span><span className="r">{order.phone}</span></div>}
        {menu && <div className="row"><span className="l">套餐</span><span className="r">{menu.name}</span></div>}

        {/* 菜色清單 */}
        {om.length > 0 && (
          <>
            <hr className="dash" />
            <div className="b sm" style={{ marginBottom: '2px' }}>── 菜色 ──────────────────────</div>
            {om.map((item, i) => (
              <div key={i} className="row">
                <span className="l">{i+1}. {item.name}{item.qty > 1 ? ` x${item.qty}` : ''}</span>
                {item.price > 0
                  ? <span className="r">${(item.price * item.qty).toLocaleString()}</span>
                  : <span />
                }
              </div>
            ))}
          </>
        )}

        {/* 金額明細 */}
        <hr className="dash" />
        {order.unit_price > 0 && (
          <div className="row">
            <span className="l">桌費</span>
            <span className="r">${order.unit_price.toLocaleString()} x {order.quantity} 桌</span>
          </div>
        )}
        {(order.adjustments??[]).map((adj, i) => (
          <div key={i} className="row">
            <span className="l">{adj.name}</span>
            <span className="r">{adj.amount >= 0 ? '+' : ''}${adj.amount.toLocaleString()}</span>
          </div>
        ))}

        {/* 合計 */}
        <hr className="dash" />
        <div className="row b lg">
          <span>合 計</span>
          <span>${total.toLocaleString()}</span>
        </div>
        <hr className="dash" />

        {/* 備註 */}
        {order.note && (
          <>
            <div className="b sm" style={{ marginBottom: '2px' }}>備註：</div>
            <div style={{ paddingLeft: '6px', whiteSpace: 'pre-wrap', fontSize: '11px' }}>{order.note}</div>
            <hr className="dash" />
          </>
        )}

        {/* 頁尾 */}
        <div className="c sm" style={{ marginTop: '8px', letterSpacing: '1px' }}>
          謝謝惠顧  歡迎再次光臨
        </div>
        <div style={{ height: '16px' }} />
      </div>
    </>
  )
}
