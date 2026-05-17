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
  phone: string | null
  note: string | null
  menu_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Menu {
  id: string
  name: string
  is_default: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  menu_id: string
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
  phone: string
  note: string
  menu_id: string | null
}
