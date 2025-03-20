# Приложение для тренировок по бадминтону

Это приложение помогает тренерам организовать игровой процесс на тренировках по бадминтону. Оно позволяет управлять списком игроков, создавать тренировки и распределять игроков по кортам во время тренировки.

## Демо

Вы можете посмотреть демо приложения здесь: [https://topsngkoder.github.io/training_assist_supabase/](https://topsngkoder.github.io/training_assist_supabase/)

## Функциональность

- Управление списком игроков (добавление, редактирование, удаление)
- Создание и управление тренировками
- Распределение игроков по кортам во время тренировки
- Управление очередью игроков
- Хранение данных в Supabase

## Технологии

- HTML5
- CSS3
- JavaScript (ES6+)
- Supabase (база данных и хранилище)

## Настройка проекта

### 1. Создание проекта в Supabase

1. Зарегистрируйтесь или войдите в [Supabase](https://supabase.com/).
2. Создайте новый проект, нажав кнопку "New Project".
3. Введите название проекта и пароль для базы данных (сохраните его, он понадобится позже).
4. Выберите регион, ближайший к вашим пользователям.
5. Нажмите "Create new project" и дождитесь создания проекта.

### 2. Настройка базы данных

1. В панели управления Supabase перейдите в раздел "SQL Editor".
2. Создайте новый запрос, нажав "New query".
3. Скопируйте содержимое файла `supabase-schema.sql` в редактор SQL.
4. Нажмите "Run" для выполнения SQL-скрипта и создания необходимых таблиц.

### 3. Настройка хранилища для изображений

1. В панели управления Supabase перейдите в раздел "Storage".
2. Нажмите "Create new bucket".
3. Введите имя бакета "player-photos".
4. Установите уровень доступа "Public".
5. Нажмите "Create bucket".
6. Настройте политики доступа для бакета:
   - Выберите созданный бакет "player-photos"
   - Перейдите на вкладку "Policies"
   - Нажмите "Create Policy"
   - Выберите шаблон "Give anon users access to all files"
   - Нажмите "Use this template"
   - Нажмите "Create policy"
7. Загрузите дефолтное изображение аватара:
   - Нажмите "Upload"
   - Выберите файл изображения
   - Переименуйте файл в "default-avatar.png"
   - Нажмите "Upload"

### 4. Настройка приложения

1. В панели управления Supabase перейдите в раздел "Settings" -> "API".
2. Скопируйте значения "Project URL" и "anon public" ключа.
3. Откройте файл `supabase.js` и замените значения переменных:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL' // Замените на Project URL
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY' // Замените на anon public ключ
   ```
4. Обновите URL дефолтного аватара в файлах `app.js` и `training-session.js`:
   ```javascript
   const defaultAvatarURL = 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/player-photos/default-avatar.png';
   ```
   Замените `YOUR_PROJECT_ID` на ID вашего проекта в Supabase.

## Локальная разработка

1. Клонируйте репозиторий:
   ```
   git clone https://github.com/topsngkoder/training_assist_supabase.git
   ```

2. Откройте проект в вашем любимом редакторе кода.

3. Для локального запуска вы можете использовать любой локальный сервер, например:
   - Live Server (расширение для VS Code)
   - Python: `python -m http.server`
   - Node.js: `npx serve`

## Структура проекта

- `index.html` - главная страница приложения
- `app.js` - основной JavaScript-код приложения
- `training-session.html` - страница тренировки
- `training-session.js` - JavaScript-код для страницы тренировки
- `supabase.js` - модуль для инициализации клиента Supabase
- `supabase-schema.sql` - SQL-скрипт для создания таблиц в Supabase
- `styles.css` - стили приложения
- `training-session.css` - дополнительные стили для страницы тренировки

## Лицензия

MIT