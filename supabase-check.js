// Файл для проверки соединения с Supabase
import supabase from './supabase.js';

// Функция для проверки соединения с Supabase
async function checkSupabaseConnection() {
    console.log('Проверка соединения с Supabase...');
    
    try {
        // Проверяем, что клиент Supabase инициализирован правильно
        if (!supabase) {
            console.error('Клиент Supabase не определен');
            return false;
        }
        
        if (!supabase.from) {
            console.error('Метод supabase.from не определен');
            return false;
        }
        
        // Проверяем соединение с Supabase
        const { data, error } = await supabase.from('players').select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error('Ошибка при проверке соединения с Supabase:', error);
            
            // Проверяем, связана ли ошибка с API ключом
            if (error.message && error.message.includes('API key')) {
                console.error('Ошибка API ключа:', error.message);
                
                // Пытаемся исправить проблему с API ключом
                const supabaseUrl = supabase.rest.url;
                const apiKey = supabaseUrl.includes('?apikey=') 
                    ? supabaseUrl.split('?apikey=')[1] 
                    : null;
                
                if (apiKey) {
                    console.log('Найден API ключ в URL, используем его');
                    supabase.rest.headers.apikey = apiKey;
                    supabase.rest.headers.Authorization = `Bearer ${apiKey}`;
                    
                    // Пробуем снова
                    const { error: retryError } = await supabase.from('players').select('count', { count: 'exact', head: true });
                    if (!retryError) {
                        console.log('Соединение с Supabase установлено успешно после исправления API ключа');
                        return true;
                    }
                }
            }
            
            return false;
        }
        
        console.log('Соединение с Supabase установлено успешно');
        return true;
    } catch (error) {
        console.error('Ошибка при проверке соединения с Supabase:', error);
        return false;
    }
}

// Экспортируем функцию
export { checkSupabaseConnection };

// Выполняем проверку при загрузке файла
checkSupabaseConnection().then(result => {
    console.log('Результат проверки соединения с Supabase:', result);
});