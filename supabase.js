// Инициализация клиента Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Эти значения нужно будет заменить на ваши после создания проекта в Supabase
const SUPABASE_URL = 'https://nthnntlbqwpxnpobbqzl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50aG5udGxicXdweG5wb2JicXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Nzg2NDgsImV4cCI6MjA1ODA1NDY0OH0.KxUhGDwN__ZuRyOHMpL7OQtNIx-Q_Epe29ym5-IhLOA'

// Создаем клиент Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default supabase