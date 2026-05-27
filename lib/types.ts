export type UserRole = 'owner' | 'staff'

export interface Profile {
  id: string
  name: string
  role: UserRole
  created_at: string
}

export interface Adjustment {
  name: string
  amount: number
}

export interface OrderMenuItem {
  name: string
  price: number  // 合菜用 0；單點填實際金額
  qty: number
  note: string
}

export interface Order {
  id: string
  order_date: string
  confirmed: boolean
  time_text: string | null
  table_no: string | null
  customer_name: string | null
  unit_price: number
  quantity: number
  adjustments: Adjustment[]
  order_menu: OrderMenuItem[]
  phone: string | null
  note: string | null
  menu_id: string | null
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Menu {
  id: string
  name: string
  price: number
  is_default: boolean
  menu_type: '合菜' | '單點'
  created_at: string
}

export interface MenuItem {
  id: string
  menu_id: string
  category: string | null
  name: string
  price: number
  sort_order: number
  note: string | null
}

export type OrderFormData = {
  order_date: string
  confirmed: boolean
  time_text: string
  table_no: string
  customer_name: string
  unit_price: number
  quantity: number
  adjustments: Adjustment[]
  order_menu: OrderMenuItem[]
  phone: string
  note: string
  menu_id: string | null
}
