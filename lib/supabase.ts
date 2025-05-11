import { createClient } from "@supabase/supabase-js"

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:", {
    url: supabaseUrl ? "set" : "missing",
    key: supabaseAnonKey ? "set" : "missing"
  })
  throw new Error("Missing required Supabase environment variables")
}

// Create a single supabase client for the entire app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // Since we're using our own JWT
  }
})

// Create admin client with service role
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    })
  : null

// Validate connection
supabase.auth.getSession().catch(error => {
  console.error("Error connecting to Supabase:", error)
})

// Type definition for the pegawai table
export type Pegawai = {
  id: number
  nip: string
  name: string
  role: "admin" | "user"
  position?: string
  workunit?: string
  email?: string
  phone?: string
  address?: string
  isapprover?: boolean
  isauthorizedofficer?: boolean
  leave_balance?: Record<string, number>
  created_at?: string
  updated_at?: string
  password?: string
}
