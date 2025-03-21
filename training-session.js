// Импортируем клиент Supabase
import supabase from './supabase.js';

// Переменные для хранения данных
let players = [];
let trainings = [];

// Объявляем переменную для дефолтного аватара
let defaultAvatarURL;

// Получаем ID тренировки из URL
const urlParams = new URLSearchParams(window.location.search);
const trainingId = parseInt(urlParams.get('id'));

// Данные текущей тренировки
let currentTraining = null;
let courtsData = [];
let queuePlayers = [];

// Отслеживание количества побед подряд для игроков
let consecutiveWins = {};

// Данные для таймеров
let gameTimers = {}; // Объект для хранения интервалов таймеров
let gameStartTimes = {}; // Объект для хранения времени начала игры

// Режим игры
let gameMode = 'play-once'; // По умолчанию "Играем один раз"

// DOM элементы
const trainingInfoElement = document.getElementById('training-info');
const courtsContainer = document.getElementById('courts-container');
const playersQueue = document.getElementById('players-queue');
const backToMainBtn = document.getElementById('back-to-main');
const gameModeSelect = document.getElementById('game-mode');

// Функция для создания аватара с инициалами
function createInitialsAvatar(firstName, lastName) {
    console.log(`Создаем аватар с инициалами для: ${firstName} ${lastName}`);

    // Проверяем, что firstName и lastName определены
    if (!firstName || !lastName) {
        console.warn('Имя или фамилия не определены, используем дефолтный аватар');
        return defaultAvatarURL;
    }

    try {
        // Создаем элемент canvas
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;

        // Получаем контекст для рисования
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Не удалось получить контекст canvas');
            return defaultAvatarURL;
        }

        // Получаем инициалы
        const firstInitial = firstName.charAt(0).toUpperCase();
        const lastInitial = lastName.charAt(0).toUpperCase();
        const initials = firstInitial + lastInitial;

        console.log(`Инициалы: ${initials}`);

        // Генерируем цвет фона на основе имени
        // Используем простой алгоритм для получения стабильного цвета
        const hash = firstName.length * 10 + lastName.length * 7;
        const colors = [
            '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
            '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6',
            '#f39c12', '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
        ];
        const bgColor = colors[Math.abs(hash) % colors.length];

        console.log(`Цвет фона: ${bgColor}`);

        // Создаем круглый фон
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, Math.PI * 2);
        ctx.fill();

        // Рисуем инициалы
        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 100);

        // Возвращаем как data URL
        try {
            const dataUrl = canvas.toDataURL('image/png');
            console.log('Аватар с инициалами успешно создан');
            return dataUrl;
        } catch (e) {
            console.error('Ошибка при создании data URL:', e);
            return defaultAvatarURL;
        }
    } catch (error) {
        console.error('Ошибка при создании аватара с инициалами:', error);
        return defaultAvatarURL;
    }
}

// Создаем дефолтное изображение (для обратной совместимости)
function createDefaultAvatar() {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Создаем круглый фон
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.fill();

    // Рисуем силуэт
    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.arc(100, 80, 40, 0, Math.PI * 2);
    ctx.fill();

    // Рисуем тело
    ctx.beginPath();
    ctx.arc(100, 200, 60, Math.PI, 0, true);
    ctx.fill();

    // Соединяем голову и тело
    ctx.fillRect(60, 80, 80, 80);

    // Возвращаем как data URL
    return canvas.toDataURL('image/png');
}

// Функция для отображения индикатора загрузки
function showLoadingIndicator() {
    // Создаем элемент индикатора загрузки, если его еще нет
    if (!document.getElementById('loading-indicator')) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.className = 'loading-overlay';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Загрузка данных...</div>
        `;
        document.body.appendChild(loadingIndicator);
    } else {
        document.getElementById('loading-indicator').style.display = 'flex';
    }
}

// Функция для скрытия индикатора загрузки
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Инициализируем дефолтный аватар
defaultAvatarURL = createDefaultAvatar();

// Импортируем функцию проверки соединения с Supabase
import { checkSupabaseConnection } from './supabase-check.js';

// Загрузка данных из Supabase
async function loadData() {
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator();

        console.log('Загрузка данных из Supabase...');
        console.log('ID тренировки из URL:', trainingId);

        // Проверяем, что клиент Supabase инициализирован правильно
        if (!supabase) {
            console.error('Клиент Supabase не определен');
            throw new Error('Клиент Supabase не определен');
        }

        if (!supabase.from) {
            console.error('Метод supabase.from не определен');
            throw new Error('Метод supabase.from не определен');
        }

        // Проверяем соединение с Supabase
        try {
            console.log('Выполняем проверку соединения с Supabase...');

            const connectionResult = await checkSupabaseConnection();
            if (!connectionResult) {
                throw new Error('Не удалось установить соединение с Supabase');
            }

            console.log('Соединение с Supabase установлено успешно');
        } catch (healthCheckError) {
            console.error('Ошибка при проверке соединения с Supabase:', healthCheckError);

            // Отображаем ошибку на странице
            if (typeof window.showSupabaseError === 'function') {
                window.showSupabaseError(healthCheckError);
            }

            throw healthCheckError;
        }

        // Загружаем игроков
        const { data: playersData, error: playersError } = await supabase
            .from('players')
            .select('*');

        if (playersError) throw playersError;

        // Преобразуем данные в формат, ожидаемый приложением
        players = playersData.map(player => ({
            id: player.id,
            firstName: player.first_name,
            lastName: player.last_name,
            rating: player.rating,
            photo: player.photo
        }));

        // Загружаем тренировки
        const { data: trainingsData, error: trainingsError } = await supabase
            .from('trainings')
            .select('*');

        if (trainingsError) throw trainingsError;

        // Загружаем связи между тренировками и игроками
        const { data: trainingPlayersData, error: trainingPlayersError } = await supabase
            .from('training_players')
            .select('*');

        if (trainingPlayersError) throw trainingPlayersError;

        // Преобразуем данные в формат, ожидаемый приложением
        trainings = trainingsData.map(training => {
            // Находим всех игроков для этой тренировки
            const playerIds = trainingPlayersData
                .filter(tp => tp.training_id === training.id)
                .map(tp => tp.player_id);

            return {
                id: training.id,
                location: training.location,
                date: training.date,
                time: training.time,
                courts: training.courts,
                playerIds: playerIds
            };
        });

        // Инициализируем тренировку
        initTrainingSession();

        return true;
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);

        // Проверяем тип ошибки
        if (error.message && (
            error.message.includes('No API key found in request') ||
            error.message.includes('API key') ||
            error.message.includes('apikey')
        )) {
            console.error('Ошибка API ключа Supabase:', error.message);

            // Отображаем ошибку на странице
            if (typeof window.showSupabaseError === 'function') {
                window.showSupabaseError({
                    message: 'Ошибка API ключа Supabase. Пожалуйста, проверьте настройки соединения с сервером.'
                });
            } else {
                alert('Ошибка соединения с сервером. Страница будет перезагружена.');
                // Перезагружаем страницу
                window.location.reload();
            }
            return false;
        }

        // Проверяем, есть ли проблемы с сетью
        if (!navigator.onLine) {
            // Отображаем ошибку на странице
            if (typeof window.showSupabaseError === 'function') {
                window.showSupabaseError({
                    message: 'Отсутствует подключение к интернету. Пожалуйста, проверьте ваше соединение и попробуйте снова.'
                });
            } else {
                alert('Отсутствует подключение к интернету. Пожалуйста, проверьте ваше соединение и попробуйте снова.');
            }
        } else {
            // Отображаем ошибку на странице
            if (typeof window.showSupabaseError === 'function') {
                window.showSupabaseError({
                    message: 'Произошла ошибка при загрузке данных: ' + (error.message || error)
                });
            } else {
                alert('Произошла ошибка при загрузке данных. Пожалуйста, попробуйте позже.\n\nДетали ошибки: ' + (error.message || error));
            }
        }

        // Скрываем индикатор загрузки
        hideLoadingIndicator();

        return false;
    } finally {
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
    }
}

// Инициализация тренировки
function initTrainingSession() {
    if (trainingId === null || isNaN(trainingId)) {
        alert('Некорректный ID тренировки');
        window.location.href = 'index.html';
        return;
    }
    
    // Находим тренировку по ID
    currentTraining = trainings.find(t => t.id === trainingId);
    
    if (!currentTraining) {
        alert('Тренировка не найдена');
        window.location.href = 'index.html';
        return;
    }

    console.log('Найдена тренировка:', currentTraining);
    
    // Отображаем информацию о тренировке
    displayTrainingInfo();
    
    // Инициализируем корты
    initCourts();
    
    // Инициализируем очередь игроков
    initQueue();
    
    // Отображаем корты и очередь
    renderCourts();
    renderQueue();

    console.log('Инициализация тренировки завершена');
}

// Отображение информации о тренировке
function displayTrainingInfo() {
    const trainingDate = new Date(`${currentTraining.date}T${currentTraining.time}`);
    const formattedDate = trainingDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    trainingInfoElement.innerHTML = `
        <p><strong>Место:</strong> ${currentTraining.location}</p>
        <p><strong>Дата и время:</strong> ${formattedDate}, ${currentTraining.time}</p>
        <p><strong>Количество кортов:</strong> ${currentTraining.courts}</p>
    `;
}

// Инициализация кортов
function initCourts() {
    courtsData = [];
    
    for (let i = 0; i < currentTraining.courts; i++) {
        courtsData.push({
            id: i,
            name: `Корт ${i + 1}`,
            side1: [],
            side2: []
        });
    }
}

// Инициализация очереди игроков
function initQueue() {
    queuePlayers = [];

    console.log('Инициализация очереди игроков для тренировки:', currentTraining);
    console.log('Доступные игроки:', players);

    if (!currentTraining) {
        console.error('Текущая тренировка не определена');
        return;
    }

    if (currentTraining.playerIds && currentTraining.playerIds.length > 0) {
        // Получаем ID игроков из таблицы training_players
        const trainingPlayerIds = currentTraining.playerIds;
        console.log('ID игроков в тренировке:', trainingPlayerIds);

        // Для каждого ID игрока находим соответствующего игрока в массиве players
        trainingPlayerIds.forEach(playerId => {
            console.log(`Поиск игрока с ID/индексом: ${playerId}, тип: ${typeof playerId}`);

            // Сначала пробуем найти игрока по его ID
            let player = players.find(p => p.id === playerId);

            if (player) {
                console.log(`Найден игрок по ID: ${player.firstName} ${player.lastName}`);
            } else {
                // Если не нашли по ID, пробуем найти по индексу
                if (typeof playerId === 'number' && playerId >= 0 && playerId < players.length) {
                    player = players[playerId];
                    console.log(`Найден игрок по индексу: ${player ? player.firstName + ' ' + player.lastName : 'не найден'}`);
                } else {
                    // Если playerId - строка, пробуем преобразовать в число и найти по индексу
                    const playerIndex = parseInt(playerId);
                    if (!isNaN(playerIndex) && playerIndex >= 0 && playerIndex < players.length) {
                        player = players[playerIndex];
                        console.log(`Найден игрок по преобразованному индексу: ${player ? player.firstName + ' ' + player.lastName : 'не найден'}`);
                    }
                }
            }

            if (player) {
                // Проверяем, не добавлен ли уже этот игрок в очередь
                const alreadyInQueue = queuePlayers.some(p => p.id === player.id);
                
                if (!alreadyInQueue) {
                    queuePlayers.push({
                        id: player.id,
                        firstName: player.firstName,
                        lastName: player.lastName,
                        photo: player.photo,
                        rating: player.rating
                    });
                    console.log(`Добавлен игрок в очередь: ${player.firstName} ${player.lastName}`);
                } else {
                    console.log(`Игрок ${player.firstName} ${player.lastName} уже в очереди, пропускаем`);
                }
            } else {
                console.warn(`Игрок с ID/индексом ${playerId} не найден`);
            }
        });
    } else {
        console.log('Нет игроков в тренировке');
    }

    // Сортируем игроков по фамилии для удобства
    queuePlayers.sort((a, b) => a.lastName.localeCompare(b.lastName));
}

// Функция для сохранения состояния тренировки в Supabase
async function saveTrainingStateToSupabase() {
    console.log('Сохранение состояния тренировки в Supabase...');
    
    if (!trainingId) {
        console.error('ID тренировки не определен, сохранение невозможно');
        return false;
    }
    
    try {
        // Формируем объект с состоянием тренировки
        const trainingState = {
            currentTraining,
            courtsData,
            queuePlayers,
            consecutiveWins,
            gameMode,
            gameStartTimes: { ...gameStartTimes },
            lastUpdated: new Date().toISOString()
        };
        
        console.log('Подготовлены данные для сохранения в Supabase');
        
        // Проверяем, существует ли уже запись для этой тренировки
        try {
            const { data: existingState, error: checkError } = await supabase
                .from('training_states')
                .select('id')
                .eq('training_id', trainingId)
                .maybeSingle();
                
            if (checkError) {
                // Проверяем, связана ли ошибка с RLS
                if (checkError.message && (
                    checkError.message.includes('permission denied') || 
                    checkError.message.includes('RLS') ||
                    checkError.message.includes('policy')
                )) {
                    console.warn('Ошибка доступа к таблице training_states (RLS):', checkError.message);
                    console.log('Сохранение в Supabase пропущено из-за ограничений RLS');
                    return false;
                }
                
                if (checkError.code !== 'PGRST116') {
                    console.error('Ошибка при проверке существующего состояния:', checkError);
                    return false;
                }
            }
            
            let result;
            
            if (existingState) {
                // Обновляем существующую запись
                console.log('Обновляем существующую запись состояния в Supabase');
                result = await supabase
                    .from('training_states')
                    .update({ state: trainingState })
                    .eq('training_id', trainingId);
            } else {
                // Создаем новую запись
                console.log('Создаем новую запись состояния в Supabase');
                result = await supabase
                    .from('training_states')
                    .insert({ training_id: trainingId, state: trainingState });
            }
            
            if (result.error) {
                // Проверяем, связана ли ошибка с RLS
                if (result.error.message && (
                    result.error.message.includes('permission denied') || 
                    result.error.message.includes('RLS') ||
                    result.error.message.includes('policy')
                )) {
                    console.warn('Ошибка доступа к таблице training_states (RLS):', result.error.message);
                    console.log('Сохранение в Supabase пропущено из-за ограничений RLS');
                    return false;
                }
                
                console.error('Ошибка при сохранении состояния в Supabase:', result.error);
                return false;
            }
            
            console.log('Состояние тренировки успешно сохранено в Supabase');
            return true;
        } catch (innerError) {
            // Проверяем, связана ли ошибка с RLS
            if (innerError.message && (
                innerError.message.includes('permission denied') || 
                innerError.message.includes('RLS') ||
                innerError.message.includes('policy')
            )) {
                console.warn('Ошибка доступа к таблице training_states (RLS):', innerError.message);
                console.log('Сохранение в Supabase пропущено из-за ограничений RLS');
                return false;
            }
            
            throw innerError;
        }
    } catch (error) {
        console.error('Ошибка при сохранении состояния в Supabase:', error);
        return false;
    }
}

// Функция для загрузки состояния тренировки из Supabase
async function loadTrainingState() {
    console.log('Загрузка состояния тренировки...');
    
    // Показываем индикатор загрузки
    showLoadingIndicator();

    try {
        // Проверяем, что клиент Supabase инициализирован правильно
        if (!supabase || !supabase.from) {
            console.error('Клиент Supabase не инициализирован правильно');
            throw new Error('Клиент Supabase не инициализирован правильно');
        }
        
        console.log('Попытка загрузки состояния из Supabase для тренировки ID:', trainingId);
        
        try {
            // Пытаемся загрузить состояние из Supabase
            const { data, error } = await supabase
                .from('training_states')
                .select('state')
                .eq('training_id', trainingId)
                .single();
    
            if (error) {
                // Проверяем, связана ли ошибка с RLS
                if (error.message && (
                    error.message.includes('permission denied') || 
                    error.message.includes('RLS') ||
                    error.message.includes('policy')
                )) {
                    console.warn('Ошибка доступа к таблице training_states (RLS):', error.message);
                    console.log('Загрузка из Supabase пропущена из-за ограничений RLS, используем localStorage');
                    return loadTrainingStateFromLocalStorage();
                }
                
                console.warn('Ошибка при загрузке состояния из Supabase:', error);
                
                // Если ошибка не связана с отсутствием данных, логируем её
                if (error.code !== 'PGRST116') {
                    console.error('Критическая ошибка при загрузке состояния из Supabase:', error);
                }
    
                // Проверяем наличие данных в localStorage
                console.log('Проверка наличия данных в localStorage...');
                const hasLocalData = localStorage.getItem(`training_state_${trainingId}`) !== null;
                
                if (hasLocalData) {
                    console.log('Найдены данные в localStorage, загружаем их...');
                    return loadTrainingStateFromLocalStorage();
                } else {
                    console.log('Данные в localStorage не найдены, инициализируем новую тренировку');
                    // Если данных нет ни в Supabase, ни в localStorage, инициализируем новую тренировку
                    initCourts();
                    initQueue();
                    displayTrainingInfo();
                    renderCourts();
                    renderQueue();
                    return true;
                }
            }
    
            if (data && data.state) {
                console.log('Данные состояния получены из Supabase');
                
                // Восстанавливаем состояние тренировки из Supabase
                const state = data.state;
    
                // Восстанавливаем состояние тренировки
                currentTraining = state.currentTraining;
                courtsData = state.courtsData || [];
                queuePlayers = state.queuePlayers || [];
                consecutiveWins = state.consecutiveWins || {};
                gameMode = state.gameMode || 'play-once';
    
                // Устанавливаем выбранный режим игры в селекте
                if (gameModeSelect) {
                    gameModeSelect.value = gameMode;
                }
    
                // Сохраняем информацию о начатых играх
                const activeGames = {};
                if (state.gameStartTimes) {
                    Object.keys(state.gameStartTimes).forEach(courtId => {
                        // Сохраняем время начала игры
                        gameStartTimes[parseInt(courtId)] = state.gameStartTimes[courtId];
                        activeGames[parseInt(courtId)] = true;
                    });
                }
    
                // Обновляем отображение
                displayTrainingInfo();
                renderCourts();
                renderQueue();
    
                // Восстанавливаем таймеры для активных игр после рендеринга кортов
                if (Object.keys(activeGames).length > 0) {
                    // Небольшая задержка, чтобы DOM успел обновиться
                    setTimeout(() => {
                        Object.keys(activeGames).forEach(courtId => {
                            courtId = parseInt(courtId);
    
                            // Запускаем таймер заново
                            const timerElement = document.getElementById(`timer-${courtId}`);
                            if (timerElement) {
                                timerElement.style.display = 'block';
    
                                // Запускаем таймер
                                gameTimers[courtId] = setInterval(() => {
                                    updateTimer(courtId);
                                }, 1000);
    
                                // Сразу обновляем таймер
                                updateTimer(courtId);
    
                                // Скрываем кнопку "Начать" и показываем кнопки "Отмена" и "Игра завершена"
                                const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
                                const actionsContainer = document.getElementById(`game-actions-${courtId}`);
    
                                if (startButton && actionsContainer) {
                                    startButton.style.display = 'none';
                                    actionsContainer.style.display = 'flex';
                                }
                            }
                        });
                    }, 100);
                }
    
                console.log('Состояние тренировки успешно загружено из Supabase');
                return true;
            } else {
                console.log('Данные состояния в Supabase отсутствуют или пусты');
                
                // Проверяем наличие данных в localStorage
                const hasLocalData = localStorage.getItem(`training_state_${trainingId}`) !== null;
                
                if (hasLocalData) {
                    console.log('Найдены данные в localStorage, загружаем их...');
                    return loadTrainingStateFromLocalStorage();
                } else {
                    console.log('Данные в localStorage не найдены, инициализируем новую тренировку');
                    // Если данных нет ни в Supabase, ни в localStorage, инициализируем новую тренировку
                    initCourts();
                    initQueue();
                    displayTrainingInfo();
                    renderCourts();
                    renderQueue();
                    return true;
                }
            }
        } catch (innerError) {
            // Проверяем, связана ли ошибка с RLS
            if (innerError.message && (
                innerError.message.includes('permission denied') || 
                innerError.message.includes('RLS') ||
                innerError.message.includes('policy')
            )) {
                console.warn('Ошибка доступа к таблице training_states (RLS):', innerError.message);
                console.log('Загрузка из Supabase пропущена из-за ограничений RLS, используем localStorage');
                return loadTrainingStateFromLocalStorage();
            }
            
            throw innerError;
        }
    } catch (error) {
        console.error('Ошибка при загрузке состояния тренировки:', error);

        // Пытаемся загрузить из localStorage как резервную копию
        console.log('Попытка загрузки из localStorage после ошибки...');
        const localStateLoaded = loadTrainingStateFromLocalStorage();
        
        if (!localStateLoaded) {
            console.log('Данные в localStorage не найдены, инициализируем новую тренировку');
            // Если данных нет ни в Supabase, ни в localStorage, инициализируем новую тренировку
            initCourts();
            initQueue();
            displayTrainingInfo();
            renderCourts();
            renderQueue();
            return true;
        }
        
        return localStateLoaded;
    } finally {
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
    }
}

// Функция для загрузки состояния тренировки из localStorage (резервная копия)
function loadTrainingStateFromLocalStorage() {
    console.log('Попытка загрузки состояния из localStorage для тренировки ID:', trainingId);
    
    // Получаем сохраненное состояние из localStorage
    const savedState = localStorage.getItem(`training_state_${trainingId}`);

    if (!savedState) {
        console.log('Состояние в localStorage не найдено');
        return false;
    }

    try {
        console.log('Состояние в localStorage найдено, парсим данные...');
        
        // Парсим сохраненное состояние
        const state = JSON.parse(savedState);
        
        if (!state || !state.currentTraining) {
            console.warn('Некорректные данные в localStorage:', state);
            return false;
        }
        
        console.log('Данные из localStorage успешно распарсены');

        // Восстанавливаем состояние тренировки
        currentTraining = state.currentTraining;
        courtsData = state.courtsData || [];
        queuePlayers = state.queuePlayers || [];
        consecutiveWins = state.consecutiveWins || {};
        gameMode = state.gameMode || 'play-once';

        // Устанавливаем выбранный режим игры в селекте
        if (gameModeSelect) {
            gameModeSelect.value = gameMode;
        }
        
        console.log('Восстановлены основные данные тренировки');
        console.log('Текущая тренировка:', currentTraining);
        console.log('Корты:', courtsData);
        console.log('Очередь игроков:', queuePlayers);

        // Сохраняем информацию о начатых играх
        const activeGames = {};
        if (state.gameStartTimes) {
            Object.keys(state.gameStartTimes).forEach(courtId => {
                // Сохраняем время начала игры
                gameStartTimes[parseInt(courtId)] = state.gameStartTimes[courtId];
                activeGames[parseInt(courtId)] = true;
            });
            console.log('Восстановлены данные о начатых играх:', activeGames);
        }

        // Обновляем отображение
        displayTrainingInfo();
        renderCourts();
        renderQueue();
        
        console.log('Отображение обновлено');

        // Восстанавливаем таймеры для активных игр после рендеринга кортов
        if (Object.keys(activeGames).length > 0) {
            console.log('Восстанавливаем таймеры для активных игр...');
            
            // Небольшая задержка, чтобы DOM успел обновиться
            setTimeout(() => {
                Object.keys(activeGames).forEach(courtId => {
                    courtId = parseInt(courtId);
                    console.log(`Восстанавливаем таймер для корта ${courtId}`);

                    // Запускаем таймер заново
                    const timerElement = document.getElementById(`timer-${courtId}`);
                    if (timerElement) {
                        timerElement.style.display = 'block';

                        // Запускаем таймер
                        gameTimers[courtId] = setInterval(() => {
                            updateTimer(courtId);
                        }, 1000);

                        // Сразу обновляем таймер
                        updateTimer(courtId);

                        // Скрываем кнопку "Начать" и показываем кнопки "Отмена" и "Игра завершена"
                        const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
                        const actionsContainer = document.getElementById(`game-actions-${courtId}`);

                        if (startButton && actionsContainer) {
                            startButton.style.display = 'none';
                            actionsContainer.style.display = 'flex';
                        }
                        
                        console.log(`Таймер для корта ${courtId} восстановлен`);
                    } else {
                        console.warn(`Элемент таймера для корта ${courtId} не найден`);
                    }
                });
            }, 100);
        }

        console.log('Состояние тренировки успешно загружено из localStorage');
        return true;
    } catch (error) {
        console.error('Ошибка при загрузке состояния тренировки из localStorage:', error);
        
        // Удаляем некорректные данные из localStorage
        localStorage.removeItem(`training_state_${trainingId}`);
        console.log('Некорректные данные удалены из localStorage');
        
        return false;
    }
}

// Функция для периодического сохранения состояния
function setupAutoSave() {
    // Сохраняем состояние каждые 30 секунд
    const autoSaveInterval = setInterval(async () => {
        console.log('Автоматическое сохранение состояния...');
        
        // Сохраняем в localStorage
        const trainingState = {
            currentTraining,
            courtsData,
            queuePlayers,
            consecutiveWins,
            gameMode,
            gameStartTimes: { ...gameStartTimes }
        };
        localStorage.setItem(`training_state_${trainingId}`, JSON.stringify(trainingState));
        
        // Пытаемся сохранить в Supabase
        try {
            await saveTrainingStateToSupabase();
        } catch (error) {
            console.error('Ошибка при автоматическом сохранении в Supabase:', error);
        }
    }, 30000); // 30 секунд
    
    // Очищаем интервал при уходе со страницы
    window.addEventListener('beforeunload', () => {
        clearInterval(autoSaveInterval);
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Загружаем данные из Supabase
        console.log('Инициализация страницы тренировки...');

        // Сначала загружаем основные данные из Supabase
        await loadData();

        // Затем пытаемся загрузить сохраненное состояние тренировки
        const stateLoaded = await loadTrainingState();

        console.log('Состояние тренировки загружено:', stateLoaded);

        // Запускаем автосохранение
        setupAutoSave();

        // Добавляем обработчик для кнопки "Назад"
        if (backToMainBtn) {
            backToMainBtn.addEventListener('click', function() {
                // Сохраняем состояние перед уходом
                const trainingState = {
                    currentTraining,
                    courtsData,
                    queuePlayers,
                    consecutiveWins,
                    gameMode,
                    gameStartTimes: { ...gameStartTimes }
                };
                localStorage.setItem(`training_state_${trainingId}`, JSON.stringify(trainingState));

                // Переходим на главную страницу
                window.location.href = 'index.html';
            });
        }

        // Добавляем обработчик для выбора режима игры
        if (gameModeSelect) {
            gameModeSelect.addEventListener('change', function() {
                gameMode = this.value;
                console.log('Выбран режим игры:', gameMode);

                // Сохраняем состояние
                saveTrainingStateToSupabase().catch(error => {
                    console.error('Ошибка при сохранении состояния:', error);
                });
            });
        }
    } catch (error) {
        console.error('Ошибка при инициализации тренировки:', error);
        alert('Произошла ошибка при загрузке данных. Пожалуйста, обновите страницу.');
    }

    // Добавляем обработчик для сохранения состояния при закрытии страницы
    window.addEventListener('beforeunload', function() {
        console.log('Страница закрывается, сохраняем состояние...');

        // Синхронно сохраняем в localStorage перед закрытием страницы
        const trainingState = {
            currentTraining,
            courtsData,
            queuePlayers,
            consecutiveWins,
            gameMode,
            gameStartTimes: { ...gameStartTimes }
        };
        localStorage.setItem(`training_state_${trainingId}`, JSON.stringify(trainingState));
    });
});

// Отображение кортов
function renderCourts() {
    console.log('Отображение кортов:', courtsData);

    // Очищаем контейнер кортов
    courtsContainer.innerHTML = '';

    // Проверяем, что courtsData определен и является массивом
    if (!Array.isArray(courtsData) || courtsData.length === 0) {
        console.warn('Нет данных о кортах для отображения');
        courtsContainer.innerHTML = '<p class="no-data">Нет данных о кортах</p>';
        return;
    }

    // Отображаем каждый корт
    courtsData.forEach(court => {
        // Создаем элемент корта
        const courtElement = document.createElement('div');
        courtElement.className = 'court';
        courtElement.dataset.courtId = court.id;

        // Создаем заголовок корта
        const courtHeader = document.createElement('div');
        courtHeader.className = 'court-header';
        courtHeader.textContent = court.name;

        // Создаем содержимое корта
        const courtContent = document.createElement('div');
        courtContent.className = 'court-content';

        // Создаем стороны корта
        const side1 = document.createElement('div');
        side1.className = 'court-side';
        side1.dataset.side = '1';

        const side2 = document.createElement('div');
        side2.className = 'court-side';
        side2.dataset.side = '2';

        // Добавляем игроков на стороны корта
        if (court.side1 && court.side1.length > 0) {
            court.side1.forEach(player => {
                const playerElement = createPlayerElement(player);
                side1.appendChild(playerElement);
            });
        } else {
            side1.innerHTML = '<div class="empty-side">Перетащите игрока сюда</div>';
        }

        if (court.side2 && court.side2.length > 0) {
            court.side2.forEach(player => {
                const playerElement = createPlayerElement(player);
                side2.appendChild(playerElement);
            });
        } else {
            side2.innerHTML = '<div class="empty-side">Перетащите игрока сюда</div>';
        }

        // Создаем элемент для таймера
        const timerElement = document.createElement('div');
        timerElement.className = 'game-timer';
        timerElement.id = `timer-${court.id}`;
        timerElement.style.display = 'none';
        timerElement.textContent = '00:00';

        // Создаем кнопки управления игрой
        const gameControls = document.createElement('div');
        gameControls.className = 'game-controls';

        // Кнопка "Начать игру"
        const startButton = document.createElement('button');
        startButton.className = 'start-game-btn';
        startButton.dataset.court = court.id;
        startButton.textContent = 'Начать игру';
        startButton.onclick = () => startGame(court.id);

        // Контейнер для кнопок "Отмена" и "Игра завершена"
        const gameActions = document.createElement('div');
        gameActions.className = 'game-actions';
        gameActions.id = `game-actions-${court.id}`;
        gameActions.style.display = 'none';

        // Кнопка "Отмена"
        const cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-game-btn';
        cancelButton.dataset.court = court.id;
        cancelButton.textContent = 'Отмена';
        cancelButton.onclick = () => cancelGame(court.id);

        // Кнопка "Игра завершена"
        const finishButton = document.createElement('button');
        finishButton.className = 'finish-game-btn';
        finishButton.dataset.court = court.id;
        finishButton.textContent = 'Игра завершена';
        finishButton.onclick = () => finishGame(court.id);

        // Добавляем кнопки в контейнер
        gameActions.appendChild(cancelButton);
        gameActions.appendChild(finishButton);

        // Добавляем кнопки в элемент управления игрой
        gameControls.appendChild(startButton);
        gameControls.appendChild(gameActions);

        // Собираем элемент корта
        courtContent.appendChild(side1);
        courtContent.appendChild(side2);
        courtElement.appendChild(courtHeader);
        courtElement.appendChild(courtContent);
        courtElement.appendChild(timerElement);
        courtElement.appendChild(gameControls);

        // Добавляем корт в контейнер
        courtsContainer.appendChild(courtElement);
    });

    // Инициализируем drag-and-drop для игроков
    initDragAndDrop();
}

// Создание элемента игрока
function createPlayerElement(player) {
    const playerElement = document.createElement('div');
    playerElement.className = 'player';
    playerElement.dataset.playerId = player.id;
    playerElement.draggable = true;

    // Добавляем обработчики событий для drag-and-drop
    playerElement.ondragstart = handleDragStart;

    // Создаем аватар игрока
    const playerAvatar = document.createElement('div');
    playerAvatar.className = 'player-avatar';

    // Если у игрока есть фото, используем его, иначе создаем аватар с инициалами
    if (player.photo) {
        const avatarImg = document.createElement('img');
        avatarImg.src = player.photo;
        avatarImg.alt = `${player.firstName} ${player.lastName}`;
        playerAvatar.appendChild(avatarImg);
    } else {
        const avatarImg = document.createElement('img');
        avatarImg.src = createInitialsAvatar(player.firstName, player.lastName);
        avatarImg.alt = `${player.firstName} ${player.lastName}`;
        playerAvatar.appendChild(avatarImg);
    }

    // Создаем информацию об игроке
    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';

    // Имя игрока
    const playerName = document.createElement('div');
    playerName.className = 'player-name';
    playerName.textContent = `${player.firstName} ${player.lastName}`;

    // Рейтинг игрока
    const playerRating = document.createElement('div');
    playerRating.className = 'player-rating';
    playerRating.textContent = player.rating ? `Рейтинг: ${player.rating}` : '';

    // Собираем элемент игрока
    playerInfo.appendChild(playerName);
    if (player.rating) {
        playerInfo.appendChild(playerRating);
    }

    playerElement.appendChild(playerAvatar);
    playerElement.appendChild(playerInfo);

    return playerElement;
}

// Отображение очереди игроков
function renderQueue() {
    console.log('Отображение очереди игроков:', queuePlayers);

    // Очищаем контейнер очереди
    playersQueue.innerHTML = '';

    // Проверяем, что queuePlayers определен и является массивом
    if (!Array.isArray(queuePlayers) || queuePlayers.length === 0) {
        console.warn('Нет игроков в очереди для отображения');
        playersQueue.innerHTML = '<p class="no-data">Нет игроков в очереди</p>';
        return;
    }

    // Отображаем каждого игрока в очереди
    queuePlayers.forEach(player => {
        const playerElement = createPlayerElement(player);
        playersQueue.appendChild(playerElement);
    });
}

// Обновление таймера
function updateTimer(courtId) {
    const timerElement = document.getElementById(`timer-${courtId}`);
    if (!timerElement) return;

    // Получаем время начала игры
    const startTime = gameStartTimes[courtId];
    if (!startTime) return;

    // Вычисляем прошедшее время
    const currentTime = new Date().getTime();
    const elapsedTime = Math.floor((currentTime - startTime) / 1000); // в секундах

    // Форматируем время
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;

    // Отображаем время
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Функция для начала игры
function startGame(courtId) {
    console.log(`Начало игры на корте ${courtId}`);

    // Получаем данные корта
    const court = courtsData.find(c => c.id === parseInt(courtId));
    if (!court) {
        console.error(`Корт с ID ${courtId} не найден`);
        return;
    }

    // Проверяем, что на обеих сторонах есть игроки
    if (!court.side1 || court.side1.length === 0 || !court.side2 || court.side2.length === 0) {
        alert('Для начала игры необходимо добавить игроков на обе стороны корта');
        return;
    }

    // Запускаем таймер
    gameStartTimes[courtId] = new Date().getTime();

    // Отображаем таймер
    const timerElement = document.getElementById(`timer-${courtId}`);
    if (timerElement) {
        timerElement.style.display = 'block';

        // Запускаем интервал для обновления таймера
        gameTimers[courtId] = setInterval(() => {
            updateTimer(courtId);
        }, 1000);

        // Сразу обновляем таймер
        updateTimer(courtId);
    }

    // Скрываем кнопку "Начать" и показываем кнопки "Отмена" и "Игра завершена"
    const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
    const actionsContainer = document.getElementById(`game-actions-${courtId}`);

    if (startButton && actionsContainer) {
        startButton.style.display = 'none';
        actionsContainer.style.display = 'flex';
    }

    // Сохраняем состояние
    saveTrainingStateToSupabase().catch(error => {
        console.error('Ошибка при сохранении состояния:', error);
    });
}

// Функция для отмены игры
function cancelGame(courtId) {
    console.log(`Отмена игры на корте ${courtId}`);

    // Останавливаем таймер
    if (gameTimers[courtId]) {
        clearInterval(gameTimers[courtId]);
        delete gameTimers[courtId];
    }

    // Удаляем время начала игры
    delete gameStartTimes[courtId];

    // Скрываем таймер
    const timerElement = document.getElementById(`timer-${courtId}`);
    if (timerElement) {
        timerElement.style.display = 'none';
    }

    // Показываем кнопку "Начать" и скрываем кнопки "Отмена" и "Игра завершена"
    const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
    const actionsContainer = document.getElementById(`game-actions-${courtId}`);

    if (startButton && actionsContainer) {
        startButton.style.display = 'block';
        actionsContainer.style.display = 'none';
    }

    // Сохраняем состояние
    saveTrainingStateToSupabase().catch(error => {
        console.error('Ошибка при сохранении состояния:', error);
    });
}

// Функция для завершения игры
function finishGame(courtId) {
    console.log(`Завершение игры на корте ${courtId}`);

    // Получаем данные корта
    const court = courtsData.find(c => c.id === parseInt(courtId));
    if (!court) {
        console.error(`Корт с ID ${courtId} не найден`);
        return;
    }

    // Останавливаем таймер
    if (gameTimers[courtId]) {
        clearInterval(gameTimers[courtId]);
        delete gameTimers[courtId];
    }

    // Удаляем время начала игры
    delete gameStartTimes[courtId];

    // Скрываем таймер
    const timerElement = document.getElementById(`timer-${courtId}`);
    if (timerElement) {
        timerElement.style.display = 'none';
    }

    // Показываем кнопку "Начать" и скрываем кнопки "Отмена" и "Игра завершена"
    const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
    const actionsContainer = document.getElementById(`game-actions-${courtId}`);

    if (startButton && actionsContainer) {
        startButton.style.display = 'block';
        actionsContainer.style.display = 'none';
    }

    // Обрабатываем результаты игры в зависимости от режима игры
    handleGameResults(court);

    // Сохраняем состояние
    saveTrainingStateToSupabase().catch(error => {
        console.error('Ошибка при сохранении состояния:', error);
    });
}

// Обработка результатов игры
function handleGameResults(court) {
    console.log('Обработка результатов игры:', court);

    // Получаем игроков с обеих сторон
    const side1Players = court.side1 || [];
    const side2Players = court.side2 || [];

    // Спрашиваем, кто победил
    const winner = confirm(`Победила команда ${court.name} стороны 1?`) ? 1 : 2;

    // Получаем победителей и проигравших
    const winners = winner === 1 ? side1Players : side2Players;
    const losers = winner === 1 ? side2Players : side1Players;

    console.log('Победители:', winners);
    console.log('Проигравшие:', losers);

    // Обновляем счетчик побед подряд
    winners.forEach(player => {
        if (!consecutiveWins[player.id]) {
            consecutiveWins[player.id] = 0;
        }
        consecutiveWins[player.id]++;
    });

    // Сбрасываем счетчик побед подряд для проигравших
    losers.forEach(player => {
        consecutiveWins[player.id] = 0;
    });

    // Обрабатываем результаты в зависимости от режима игры
    switch (gameMode) {
        case 'play-once':
            // Все игроки уходят с корта и становятся в очередь
            movePlayersToQueue(side1Players);
            movePlayersToQueue(side2Players);
            break;

        case 'max-twice':
            // Победители остаются, если не выиграли дважды подряд
            const allWinnersStay = winners.every(player => consecutiveWins[player.id] < 2);

            if (allWinnersStay) {
                // Победители остаются
                if (winner === 1) {
                    // Проигравшие уходят в очередь
                    movePlayersToQueue(side2Players);
                    // Очищаем сторону 2
                    court.side2 = [];
                } else {
                    // Проигравшие уходят в очередь
                    movePlayersToQueue(side1Players);
                    // Очищаем сторону 1
                    court.side1 = [];
                }
            } else {
                // Все игроки уходят с корта и становятся в очередь
                movePlayersToQueue(side1Players);
                movePlayersToQueue(side2Players);
            }
            break;

        case 'winner-stays':
            // Победители всегда остаются
            if (winner === 1) {
                // Проигравшие уходят в очередь
                movePlayersToQueue(side2Players);
                // Очищаем сторону 2
                court.side2 = [];
            } else {
                // Проигравшие уходят в очередь
                movePlayersToQueue(side1Players);
                // Очищаем сторону 1
                court.side1 = [];
            }
            break;
    }

    // Обновляем отображение
    renderCourts();
    renderQueue();
}

// Перемещение игроков в очередь
function movePlayersToQueue(players) {
    if (!players || players.length === 0) return;

    players.forEach(player => {
        // Проверяем, нет ли уже этого игрока в очереди
        const existingPlayer = queuePlayers.find(p => p.id === player.id);
        if (!existingPlayer) {
            queuePlayers.push(player);
        }
    });
}

// Инициализация drag-and-drop
function initDragAndDrop() {
    // Получаем все элементы, которые могут быть целями для drop
    const dropTargets = document.querySelectorAll('.court-side');

    // Добавляем обработчики событий для каждой цели
    dropTargets.forEach(target => {
        target.ondragover = handleDragOver;
        target.ondrop = handleDrop;
        target.ondragenter = handleDragEnter;
        target.ondragleave = handleDragLeave;
    });
}

// Обработчик начала перетаскивания
function handleDragStart(e) {
    // Сохраняем ID игрока в данных перетаскивания
    e.dataTransfer.setData('text/plain', e.target.dataset.playerId);

    // Добавляем класс для стилизации
    e.target.classList.add('dragging');
}

// Обработчик события dragover
function handleDragOver(e) {
    // Предотвращаем стандартное поведение (запрет drop)
    e.preventDefault();
}

// Обработчик события dragenter
function handleDragEnter(e) {
    // Добавляем класс для стилизации
    e.target.classList.add('drag-over');
}

// Обработчик события dragleave
function handleDragLeave(e) {
    // Удаляем класс для стилизации
    e.target.classList.remove('drag-over');
}

// Обработчик события drop
function handleDrop(e) {
    // Предотвращаем стандартное поведение
    e.preventDefault();

    // Удаляем класс для стилизации
    e.target.classList.remove('drag-over');

    // Получаем ID игрока из данных перетаскивания
    const playerId = e.dataTransfer.getData('text/plain');

    // Находим игрока
    let player;

    // Проверяем, есть ли игрок в очереди
    const queuePlayerIndex = queuePlayers.findIndex(p => p.id.toString() === playerId);
    if (queuePlayerIndex !== -1) {
        player = queuePlayers[queuePlayerIndex];
        // Удаляем игрока из очереди
        queuePlayers.splice(queuePlayerIndex, 1);
    } else {
        // Проверяем, есть ли игрок на кортах
        for (const court of courtsData) {
            // Проверяем сторону 1
            const side1PlayerIndex = court.side1.findIndex(p => p.id.toString() === playerId);
            if (side1PlayerIndex !== -1) {
                player = court.side1[side1PlayerIndex];
                // Удаляем игрока с корта
                court.side1.splice(side1PlayerIndex, 1);
                break;
            }

            // Проверяем сторону 2
            const side2PlayerIndex = court.side2.findIndex(p => p.id.toString() === playerId);
            if (side2PlayerIndex !== -1) {
                player = court.side2[side2PlayerIndex];
                // Удаляем игрока с корта
                court.side2.splice(side2PlayerIndex, 1);
                break;
            }
        }
    }

    if (!player) {
        console.error(`Игрок с ID ${playerId} не найден`);
        return;
    }

    // Получаем корт и сторону, на которую перетаскиваем игрока
    const courtElement = e.target.closest('.court');
    const courtId = parseInt(courtElement.dataset.courtId);
    const side = parseInt(e.target.dataset.side);

    // Находим корт
    const court = courtsData.find(c => c.id === courtId);
    if (!court) {
        console.error(`Корт с ID ${courtId} не найден`);
        return;
    }

    // Добавляем игрока на соответствующую сторону корта
    if (side === 1) {
        court.side1.push(player);
    } else {
        court.side2.push(player);
    }

    // Обновляем отображение
    renderCourts();
    renderQueue();

    // Сохраняем состояние
    saveTrainingStateToSupabase().catch(error => {
        console.error('Ошибка при сохранении состояния:', error);
    });
}