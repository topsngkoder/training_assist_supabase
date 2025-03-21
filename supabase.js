// Инициализация клиента Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Эти значения нужно будет заменить на ваши после создания проекта в Supabase
const SUPABASE_URL = 'https://nthnntlbqwpxnpobbqzl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50aG5udGxicXdweG5wb2JicXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Nzg2NDgsImV4cCI6MjA1ODA1NDY0OH0.KxUhGDwN__ZuRyOHMpL7OQtNIx-Q_Epe29ym5-IhLOA'

// Создаем клиент Supabase с дополнительными опциями
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true, // Сохраняем сессию в localStorage
        autoRefreshToken: true, // Автоматически обновляем токен
        detectSessionInUrl: false // Не ищем сессию в URL
    },
    global: {
        headers: {
            'apikey': SUPABASE_ANON_KEY, // Добавляем API ключ в заголовки всех запросов
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}` // Добавляем токен авторизации
        }
    }
})

// Проверяем инициализацию клиента
console.log('Supabase клиент инициализирован:', !!supabase)
console.log('Supabase URL:', SUPABASE_URL)
console.log('API ключ установлен:', !!SUPABASE_ANON_KEY)

// Экспортируем клиент
export default supabase