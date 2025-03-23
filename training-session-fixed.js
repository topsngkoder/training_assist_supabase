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

// Загрузка данных из Supabase
async function loadData() {
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator();

        console.log('Загрузка данных из Supabase...');
        console.log('ID тренировки из URL:', trainingId);

        // Проверяем, что клиент Supabase инициализирован правильно
        if (!supabase || !supabase.from) {
            throw new Error('Клиент Supabase не инициализирован правильно');
        }

        // Проверяем соединение с Supabase
        try {
            const { error: healthCheckError } = await supabase.from('players').select('count', { count: 'exact', head: true });
            if (healthCheckError) {
                console.error('Ошибка при проверке соединения с Supabase:', healthCheckError);
                throw healthCheckError;
            }
            console.log('Соединение с Supabase установлено успешно');
        } catch (healthCheckError) {
            console.error('Ошибка при проверке соединения с Supabase:', healthCheckError);
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
        if (error.message && error.message.includes('No API key found in request')) {
            console.error('Ошибка API ключа Supabase. Перезагрузка страницы...');
            alert('Ошибка соединения с сервером. Страница будет перезагружена.');
            // Перезагружаем страницу
            window.location.reload();
            return;
        }
        
        // Проверяем, есть ли проблемы с сетью
        if (!navigator.onLine) {
            alert('Отсутствует подключение к интернету. Пожалуйста, проверьте ваше соединение и попробуйте снова.');
        } else {
            alert('Произошла ошибка при загрузке данных. Пожалуйста, попробуйте позже.\n\nДетали ошибки: ' + (error.message || error));
        }
        
        // Возвращаемся на главную страницу
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
        
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
    courtsContainer.innerHTML = '';

    courtsData.forEach(court => {
        const courtCard = document.createElement('div');
        courtCard.classList.add('court-card');

        // Создаем HTML для игроков на стороне 1
        let side1PlayersHtml = '';
        if (court.side1 && court.side1.length > 0) {
            court.side1.forEach(player => {
                const photoSrc = player.photo || defaultAvatarURL;
                side1PlayersHtml += `
                    <div class="court-player">
                        <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="court-player-photo">
                        <div class="player-name-container">
                            <div>${player.firstName} ${player.lastName}</div>
                            <span class="remove-player" data-court="${court.id}" data-side="1" data-index="${court.side1.indexOf(player)}">&times;</span>
                        </div>
                    </div>
                `;
            });
        }

        // Создаем HTML для игроков на стороне 2
        let side2PlayersHtml = '';
        if (court.side2 && court.side2.length > 0) {
            court.side2.forEach(player => {
                const photoSrc = player.photo || defaultAvatarURL;
                side2PlayersHtml += `
                    <div class="court-player">
                        <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="court-player-photo">
                        <div class="player-name-container">
                            <div>${player.firstName} ${player.lastName}</div>
                            <span class="remove-player" data-court="${court.id}" data-side="2" data-index="${court.side2.indexOf(player)}">&times;</span>
                        </div>
                    </div>
                `;
            });
        }

        // Проверяем, идет ли игра на этом корте
        const isGameInProgress = gameStartTimes[court.id] !== undefined;

        courtCard.innerHTML = `
            <div class="court-header">
                <div class="court-title-container">
                    <div class="court-title">${court.name}</div>
                </div>
                <div class="court-timer" id="timer-${court.id}" style="display: ${isGameInProgress ? 'block' : 'none'}">00:00</div>
            </div>
            <div class="court-sides">
                <div class="court-side side1">
                    <div class="court-players">
                        ${side1PlayersHtml}
                    </div>
                    <div class="court-buttons">
                        <button class="btn quick-add-btn ${court.side1.length >= 2 || queuePlayers.length === 0 ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="1"
                                ${court.side1.length >= 2 || queuePlayers.length === 0 ? 'disabled' : ''}>
                            Очередь
                        </button>
                        <button class="btn select-add-btn ${court.side1.length >= 2 ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="1"
                                ${court.side1.length >= 2 ? 'disabled' : ''}>
                            +
                        </button>
                    </div>
                </div>
                <div class="court-side side2">
                    <div class="court-players">
                        ${side2PlayersHtml}
                    </div>
                    <div class="court-buttons">
                        <button class="btn quick-add-btn ${court.side2.length >= 2 || queuePlayers.length === 0 ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="2"
                                ${court.side2.length >= 2 || queuePlayers.length === 0 ? 'disabled' : ''}>
                            Очередь
                        </button>
                        <button class="btn select-add-btn ${court.side2.length >= 2 ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="2"
                                ${court.side2.length >= 2 ? 'disabled' : ''}>
                            +
                        </button>
                    </div>
                </div>
            </div>
            <div class="court-actions">
                <button class="btn start-game-btn" data-court="${court.id}" style="display: ${isGameInProgress ? 'none' : 'block'}">Начать игру</button>
                <div class="game-in-progress-actions" id="game-actions-${court.id}" style="display: ${isGameInProgress ? 'flex' : 'none'}">
                    <button class="btn cancel-game-btn" data-court="${court.id}">Отмена</button>
                    <button class="btn finish-game-btn" data-court="${court.id}">Игра завершена</button>
                </div>
            </div>
        `;

        courtsContainer.appendChild(courtCard);

        // Если игра уже идет, обновляем таймер
        if (isGameInProgress) {
            updateTimer(court.id);

            // Запускаем таймер, если он еще не запущен
            if (!gameTimers[court.id]) {
                gameTimers[court.id] = setInterval(() => {
                    updateTimer(court.id);
                }, 1000);
            }
        }
    });

    // Добавляем обработчики для кнопок
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const courtId = parseInt(this.getAttribute('data-court'));
            const side = parseInt(this.getAttribute('data-side'));
            addFirstPlayerFromQueue(courtId, side);
        });
    });

    document.querySelectorAll('.select-add-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const courtId = parseInt(this.getAttribute('data-court'));
            const side = parseInt(this.getAttribute('data-side'));
            showPlayerSelectionDialog(courtId, side);
        });
    });

    document.querySelectorAll('.start-game-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const courtId = parseInt(this.getAttribute('data-court'));
            startGame(courtId);
        });
    });

    document.querySelectorAll('.cancel-game-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const courtId = parseInt(this.getAttribute('data-court'));
            cancelGame(courtId);
        });
    });

    document.querySelectorAll('.finish-game-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const courtId = parseInt(this.getAttribute('data-court'));
            finishGame(courtId);
        });
    });

    // Добавляем обработчики для крестиков удаления игроков
    document.querySelectorAll('.remove-player').forEach(btn => {
        btn.addEventListener('click', function() {
            const courtId = parseInt(this.getAttribute('data-court'));
            const side = parseInt(this.getAttribute('data-side'));
            const playerIndex = parseInt(this.getAttribute('data-index'));
            removePlayerFromCourt(courtId, side, playerIndex);
        });
    });
}

// Отображение очереди игроков
function renderQueue() {
    playersQueue.innerHTML = '';

    if (!Array.isArray(queuePlayers) || queuePlayers.length === 0) {
        playersQueue.innerHTML = '<p class="no-data">Нет игроков в очереди</p>';
        return;
    }

    queuePlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('queue-player');

        const photoSrc = player.photo || defaultAvatarURL;

        playerElement.innerHTML = `
            <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="queue-player-photo">
            <span class="queue-player-name">${player.firstName} ${player.lastName}</span>
        `;

        playersQueue.appendChild(playerElement);
    });
}

// Показать диалог выбора игрока для добавления на корт
function showPlayerSelectionDialog(courtId, side) {
    if (queuePlayers.length === 0) {
        alert('Нет доступных игроков в очереди');
        return;
    }

    // Проверяем, есть ли место на выбранной стороне корта
    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    const sideArray = side === 1 ? court.side1 : court.side2;
    if (sideArray.length >= 2) {
        alert('На этой стороне уже максимальное количество игроков (2)');
        return;
    }

    // Создаем модальное окно для выбора игрока
    const modal = document.createElement('div');
    modal.classList.add('player-selection-modal');

    const modalContent = document.createElement('div');
    modalContent.classList.add('player-selection-modal-content');

    // Заголовок модального окна
    const modalHeader = document.createElement('div');
    modalHeader.classList.add('player-selection-modal-header');
    modalHeader.innerHTML = `
        <h3>Выберите игрока</h3>
        <span class="close-modal">&times;</span>
    `;

    // Список игроков
    const playersList = document.createElement('div');
    playersList.classList.add('player-selection-list');

    queuePlayers.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-selection-item');

        const photoSrc = player.photo || defaultAvatarURL;

        playerItem.innerHTML = `
            <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="player-selection-photo">
            <span class="player-selection-name">${player.firstName} ${player.lastName}</span>
        `;

        // Добавляем обработчик клика для выбора игрока
        playerItem.addEventListener('click', function() {
            // Добавляем выбранного игрока на корт
            const success = addPlayerToCourt(courtId, side, player);

            if (success !== false) {
                // Удаляем игрока из очереди
                queuePlayers.splice(index, 1);

                // Обновляем отображение
                renderCourts();
                renderQueue();

                // Закрываем модальное окно
                document.body.removeChild(modal);
            }
        });

        playersList.appendChild(playerItem);
    });

    // Собираем модальное окно
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(playersList);
    modal.appendChild(modalContent);

    // Добавляем обработчик для закрытия модального окна
    const closeBtn = modalHeader.querySelector('.close-modal');
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
    });

    // Добавляем обработчик для закрытия модального окна при клике вне его
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // Добавляем модальное окно в DOM
    document.body.appendChild(modal);
}

// Обновление таймера
function updateTimer(courtId) {
    // Реализация функции updateTimer
}