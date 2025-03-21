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

// Инициализируем дефолтный аватар
defaultAvatarURL = createDefaultAvatar();

// Загрузка данных из Supabase
async function loadData() {
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator();

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
                .map(tp => {
                    // Находим индекс игрока в массиве players
                    return players.findIndex(p => p.id === tp.player_id);
                })
                .filter(index => index !== -1); // Убираем несуществующих игроков

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
        alert('Произошла ошибка при загрузке данных. Пожалуйста, попробуйте позже.');
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
    
    // Отображаем информацию о тренировке
    displayTrainingInfo();
    
    // Инициализируем корты
    initCourts();
    
    // Инициализируем очередь игроков
    initQueue();
    
    // Отображаем корты и очередь
    renderCourts();
    renderQueue();
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
    
    if (currentTraining.playerIds && currentTraining.playerIds.length > 0) {
        currentTraining.playerIds.forEach(playerIndex => {
            const player = players[playerIndex];
            if (player) {
                queuePlayers.push({
                    id: player.id,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    photo: player.photo,
                    rating: player.rating
                });
            }
        });
    }
}

// Отображение кортов
function renderCourts() {
    courtsContainer.innerHTML = '';

    courtsData.forEach(court => {
        const courtCard = document.createElement('div');
        courtCard.classList.add('court-card');

        // Проверяем, запущен ли таймер для этого корта
        const isGameInProgress = gameTimers[court.id] !== undefined;

        // Если игра в процессе, убедимся, что таймер отображается
        if (isGameInProgress) {
            const timerElement = document.getElementById(`timer-${court.id}`);
            if (timerElement) {
                timerElement.style.display = 'block';
            }
        }
        
        // Создаем HTML для игроков на стороне 1
        let side1PlayersHtml = '';
        if (court.side1.length > 0) {
            court.side1.forEach(player => {
                // Если у игрока нет фото, создаем аватар с инициалами
                let photoSrc;
                if (player.photo) {
                    photoSrc = player.photo;
                } else {
                    photoSrc = createInitialsAvatar(player.firstName, player.lastName);
                }
                // Проверяем, играет ли игрок вторую игру подряд в режиме "Не более двух раз"
                const isSecondGame = consecutiveWins[player.id] && gameMode === 'max-twice';

                // Получаем количество побед подряд для режима "Победитель остается всегда"
                const winStreak = gameMode === 'winner-stays' && consecutiveWins[player.id] ? consecutiveWins[player.id] : 0;

                side1PlayersHtml += `
                    <div class="court-player ${isSecondGame ? 'second-game' : ''} ${winStreak > 0 ? 'win-streak' : ''}">
                        <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="court-player-photo">
                        <div class="player-name-container">
                            <div>
                                ${player.firstName} ${player.lastName}
                                ${isSecondGame ? '<span class="second-game-badge" title="2-я игра">2</span>' : ''}
                                ${winStreak > 0 ? `<span class="win-streak-badge" title="Побед подряд: ${winStreak}">${winStreak}</span>` : ''}
                            </div>
                            ${isGameInProgress ? '' : `<span class="remove-player" data-court="${court.id}" data-side="1" data-index="${court.side1.indexOf(player)}">&times;</span>`}
                        </div>
                    </div>
                `;
            });
        }

        // Создаем HTML для игроков на стороне 2
        let side2PlayersHtml = '';
        if (court.side2.length > 0) {
            court.side2.forEach(player => {
                // Если у игрока нет фото, создаем аватар с инициалами
                let photoSrc;
                if (player.photo) {
                    photoSrc = player.photo;
                } else {
                    photoSrc = createInitialsAvatar(player.firstName, player.lastName);
                }
                // Проверяем, играет ли игрок вторую игру подряд в режиме "Не более двух раз"
                const isSecondGame = consecutiveWins[player.id] && gameMode === 'max-twice';

                // Получаем количество побед подряд для режима "Победитель остается всегда"
                const winStreak = gameMode === 'winner-stays' && consecutiveWins[player.id] ? consecutiveWins[player.id] : 0;

                side2PlayersHtml += `
                    <div class="court-player ${isSecondGame ? 'second-game' : ''} ${winStreak > 0 ? 'win-streak' : ''}">
                        <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="court-player-photo">
                        <div class="player-name-container">
                            <div>
                                ${player.firstName} ${player.lastName}
                                ${isSecondGame ? '<span class="second-game-badge" title="2-я игра">2</span>' : ''}
                                ${winStreak > 0 ? `<span class="win-streak-badge" title="Побед подряд: ${winStreak}">${winStreak}</span>` : ''}
                            </div>
                            ${isGameInProgress ? '' : `<span class="remove-player" data-court="${court.id}" data-side="2" data-index="${court.side2.indexOf(player)}">&times;</span>`}
                        </div>
                    </div>
                `;
            });
        }

        courtCard.innerHTML = `
            <div class="court-header">
                <div class="court-title-container">
                    <div class="court-title">${court.name}</div>
                    <div class="court-timer" id="timer-${court.id}" style="display: ${isGameInProgress ? 'block' : 'none'}">00:00</div>
                </div>
            </div>
            <div class="court-sides">
                <div class="court-side side1">
                    <div class="court-players">
                        ${side1PlayersHtml}
                    </div>
                    <div class="court-buttons">
                        <button class="btn quick-add-btn ${court.side1.length >= 2 || queuePlayers.length === 0 || isGameInProgress ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="1"
                                ${court.side1.length >= 2 || queuePlayers.length === 0 || isGameInProgress ? 'disabled' : ''}>
                            Очередь
                        </button>
                        <button class="btn select-add-btn ${court.side1.length >= 2 || isGameInProgress ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="1"
                                ${court.side1.length >= 2 || isGameInProgress ? 'disabled' : ''}>
                            +
                        </button>
                    </div>
                </div>
                <div class="court-side side2">
                    <div class="court-players">
                        ${side2PlayersHtml}
                    </div>
                    <div class="court-buttons">
                        <button class="btn quick-add-btn ${court.side2.length >= 2 || queuePlayers.length === 0 || isGameInProgress ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="2"
                                ${court.side2.length >= 2 || queuePlayers.length === 0 || isGameInProgress ? 'disabled' : ''}>
                            Очередь
                        </button>
                        <button class="btn select-add-btn ${court.side2.length >= 2 || isGameInProgress ? 'disabled' : ''}"
                                data-court="${court.id}"
                                data-side="2"
                                ${court.side2.length >= 2 || isGameInProgress ? 'disabled' : ''}>
                            +
                        </button>
                    </div>
                </div>
            </div>
            <div class="court-actions">
                <button class="btn start-game-btn ${(court.side1.length === 0 || court.side2.length === 0 || court.side1.length > 2 || court.side2.length > 2) ? 'disabled' : ''}"
                        data-court="${court.id}"
                        style="display: ${isGameInProgress ? 'none' : 'block'}"
                        ${(court.side1.length === 0 || court.side2.length === 0 || court.side1.length > 2 || court.side2.length > 2) ? 'disabled' : ''}>
                    Начать
                </button>
                <div class="game-in-progress-actions" id="game-actions-${court.id}" style="display: ${isGameInProgress ? 'flex' : 'none'}">
                    <button class="btn cancel-game-btn secondary-btn" data-court="${court.id}">Отмена</button>
                    <button class="btn finish-game-btn" data-court="${court.id}">Игра завершена</button>
                </div>
            </div>
        `;
        
        courtsContainer.appendChild(courtCard);
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

    // Обновляем таймеры для кортов, где игра в процессе
    Object.keys(gameTimers).forEach(courtId => {
        updateTimer(parseInt(courtId));
    });
}

// Отображение очереди игроков
function renderQueue() {
    playersQueue.innerHTML = '';

    queuePlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('queue-player');

        // Если у игрока нет фото, создаем аватар с инициалами
        let photoSrc;
        if (player.photo) {
            photoSrc = player.photo;
        } else {
            photoSrc = createInitialsAvatar(player.firstName, player.lastName);
        }

        playerElement.innerHTML = `
            <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="queue-player-photo">
            <span class="queue-player-name">${player.firstName} ${player.lastName}</span>
        `;

        playersQueue.appendChild(playerElement);
    });
}

// Быстрое добавление первого игрока из очереди на корт
function addFirstPlayerFromQueue(courtId, side) {
    if (queuePlayers.length === 0) {
        alert('Нет доступных игроков в очереди');
        return;
    }

    // Проверяем, есть ли место на выбранной стороне корта
    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    // Проверяем, не запущена ли игра на этом корте
    if (gameTimers[courtId] !== undefined) {
        alert('Нельзя изменять состав участников во время игры');
        return;
    }

    const sideArray = side === 1 ? court.side1 : court.side2;
    if (sideArray.length >= 2) {
        alert('На этой стороне уже максимальное количество игроков (2)');
        return;
    }

    // Берем первого игрока из очереди
    const player = queuePlayers[0];

    // Добавляем игрока на корт
    const success = addPlayerToCourt(courtId, side, player);

    if (success !== false) {
        // Удаляем игрока из очереди
        queuePlayers.splice(0, 1);

        // Обновляем отображение
        renderCourts();
        renderQueue();
    }
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

    // Проверяем, не запущена ли игра на этом корте
    if (gameTimers[courtId] !== undefined) {
        alert('Нельзя изменять состав участников во время игры');
        return;
    }

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

        // Если у игрока нет фото, создаем аватар с инициалами
        let photoSrc;
        if (player.photo) {
            photoSrc = player.photo;
        } else {
            photoSrc = createInitialsAvatar(player.firstName, player.lastName);
        }

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

// Добавление игрока на корт
function addPlayerToCourt(courtId, side, player) {
    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    // Проверяем, не запущена ли игра на этом корте
    if (gameTimers[courtId] !== undefined) {
        alert('Нельзя изменять состав участников во время игры');
        return false;
    }

    // Проверяем, что на стороне не более 2 игроков
    if (side === 1) {
        if (court.side1.length >= 2) {
            alert('На этой стороне уже максимальное количество игроков (2)');
            return false;
        }
        court.side1.push(player);
    } else {
        if (court.side2.length >= 2) {
            alert('На этой стороне уже максимальное количество игроков (2)');
            return false;
        }
        court.side2.push(player);
    }

    return true;
}

// Удаление игрока с корта и возвращение его в очередь
function removePlayerFromCourt(courtId, side, playerIndex) {
    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    // Проверяем, не запущена ли игра на этом корте
    if (gameTimers[courtId] !== undefined) {
        alert('Нельзя изменять состав участников во время игры');
        return;
    }

    let removedPlayer;

    // Удаляем игрока с корта
    if (side === 1) {
        if (playerIndex < 0 || playerIndex >= court.side1.length) return;
        removedPlayer = court.side1.splice(playerIndex, 1)[0];
    } else {
        if (playerIndex < 0 || playerIndex >= court.side2.length) return;
        removedPlayer = court.side2.splice(playerIndex, 1)[0];
    }

    // Добавляем игрока в начало очереди
    if (removedPlayer) {
        // Сбрасываем счетчик побед для удаленного игрока
        if (consecutiveWins[removedPlayer.id]) {
            delete consecutiveWins[removedPlayer.id];
        }

        queuePlayers.unshift(removedPlayer);
    }

    // Обновляем отображение
    renderCourts();
    renderQueue();
}

// Запуск игры на корте
function startGame(courtId) {
    // Проверяем, что на каждой стороне корта есть по 1 или 2 игрока
    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    if (court.side1.length === 0 || court.side2.length === 0 || court.side1.length > 2 || court.side2.length > 2) {
        alert('Для начала игры на каждой стороне корта должно быть по 1 или 2 игрока');
        return;
    }

    // Показываем таймер
    const timerElement = document.getElementById(`timer-${courtId}`);
    timerElement.style.display = 'block';

    // Скрываем кнопку "Начать" и показываем кнопки "Отмена" и "Игра завершена"
    const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
    const actionsContainer = document.getElementById(`game-actions-${courtId}`);

    startButton.style.display = 'none';
    actionsContainer.style.display = 'flex';

    // Запускаем таймер
    gameStartTimes[courtId] = Date.now();

    // Обновляем таймер каждую секунду
    gameTimers[courtId] = setInterval(() => {
        updateTimer(courtId);
    }, 1000);

    // Сразу обновляем таймер, чтобы показать 00:00
    updateTimer(courtId);

    // Перерисовываем корты, чтобы применить ограничения на изменение состава игроков
    renderCourts();

    // Сохраняем состояние тренировки в Supabase
    saveTrainingState();
}

// Обновление таймера
function updateTimer(courtId) {
    const timerElement = document.getElementById(`timer-${courtId}`);
    const startTime = gameStartTimes[courtId];
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    // Форматируем время в формат MM:SS
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerElement.textContent = formattedTime;
}

// Отмена игры (сброс таймера)
function cancelGame(courtId) {
    // Останавливаем таймер
    clearInterval(gameTimers[courtId]);
    delete gameTimers[courtId];
    delete gameStartTimes[courtId];

    // Скрываем таймер
    const timerElement = document.getElementById(`timer-${courtId}`);
    timerElement.style.display = 'none';

    // Показываем кнопку "Начать" и скрываем кнопки "Отмена" и "Игра завершена"
    const startButton = document.querySelector(`.start-game-btn[data-court="${courtId}"]`);
    const actionsContainer = document.getElementById(`game-actions-${courtId}`);

    startButton.style.display = 'block';
    actionsContainer.style.display = 'none';

    // Получаем корт
    const court = courtsData.find(c => c.id === courtId);
    if (court) {
        // Сбрасываем счетчик побед для всех игроков на корте
        [...court.side1, ...court.side2].forEach(player => {
            if (consecutiveWins[player.id]) {
                delete consecutiveWins[player.id];
            }
        });
    }

    // Перерисовываем корты, чтобы снять ограничения на изменение состава игроков
    renderCourts();

    // Сохраняем состояние тренировки в Supabase
    saveTrainingState();
}

// Завершение игры на корте
function finishGame(courtId) {
    // Останавливаем таймер
    if (gameTimers[courtId]) {
        clearInterval(gameTimers[courtId]);
        delete gameTimers[courtId];
        delete gameStartTimes[courtId];
    }

    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    // Проверяем, что на обеих сторонах есть игроки
    if (court.side1.length === 0 || court.side2.length === 0) {
        alert('Невозможно завершить игру: на одной из сторон нет игроков');
        return;
    }

    // Создаем всплывающее окно для выбора победителя
    showWinnerSelectionDialog(courtId, court);
}

// Показать диалог выбора победителя
function showWinnerSelectionDialog(courtId, court) {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.classList.add('player-selection-modal');

    const modalContent = document.createElement('div');
    modalContent.classList.add('player-selection-modal-content');

    // Заголовок модального окна
    const modalHeader = document.createElement('div');
    modalHeader.classList.add('player-selection-modal-header');
    modalHeader.innerHTML = `
        <h3>Кто победил?</h3>
        <span class="close-modal">&times;</span>
    `;

    // Формируем имена игроков для каждой стороны
    const side1Names = court.side1.map(player => `${player.lastName}`).join('/');
    const side2Names = court.side2.map(player => `${player.lastName}`).join('/');

    // Создаем кнопки для выбора победителя
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('winner-buttons-container');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexDirection = 'column';
    buttonsContainer.style.gap = '10px';
    buttonsContainer.style.marginTop = '20px';

    const side1Button = document.createElement('button');
    side1Button.classList.add('btn', 'winner-btn');
    side1Button.textContent = side1Names;
    side1Button.style.padding = '10px 20px';
    side1Button.style.fontSize = '16px';

    const side2Button = document.createElement('button');
    side2Button.classList.add('btn', 'winner-btn');
    side2Button.textContent = side2Names;
    side2Button.style.padding = '10px 20px';
    side2Button.style.fontSize = '16px';

    // Добавляем обработчики для кнопок
    side1Button.addEventListener('click', function() {
        // Здесь можно добавить логику для записи победителя
        console.log(`Победители: ${side1Names}`);

        // Завершаем игру, указывая сторону 1 как победителя
        finishGameAfterWinnerSelection(courtId, 1);

        // Закрываем модальное окно
        document.body.removeChild(modal);
    });

    side2Button.addEventListener('click', function() {
        // Здесь можно добавить логику для записи победителя
        console.log(`Победители: ${side2Names}`);

        // Завершаем игру, указывая сторону 2 как победителя
        finishGameAfterWinnerSelection(courtId, 2);

        // Закрываем модальное окно
        document.body.removeChild(modal);
    });

    // Добавляем кнопки в контейнер
    buttonsContainer.appendChild(side1Button);
    buttonsContainer.appendChild(side2Button);

    // Собираем модальное окно
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(buttonsContainer);
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

// Завершение игры после выбора победителя
function finishGameAfterWinnerSelection(courtId, winningSide) {
    const court = courtsData.find(c => c.id === courtId);
    if (!court) return;

    // Получаем победителей и проигравших
    const winners = winningSide === 1 ? [...court.side1] : [...court.side2];
    const losers = winningSide === 1 ? [...court.side2] : [...court.side1];

    // Обрабатываем игроков в зависимости от режима игры
    if (gameMode === 'play-once') {
        // Режим "Играем один раз" - все игроки перемещаются в конец очереди,
        // сначала победители, а за ними проигравшие
        winners.forEach(player => {
            queuePlayers.push(player);
        });

        losers.forEach(player => {
            queuePlayers.push(player);
        });
    } else if (gameMode === 'max-twice') {
        // Режим "Не более двух раз" - победитель остается на корте, но если победитель
        // побеждает второй раз подряд, он уходит в конец очереди

        // Проверяем, есть ли среди победителей игроки, которые уже выиграли один раз
        let secondWin = false;
        winners.forEach(player => {
            // Если у игрока уже есть победа, значит это вторая победа подряд
            if (consecutiveWins[player.id]) {
                secondWin = true;
            }
        });

        if (secondWin) {
            // Если это вторая победа подряд, победители уходят в конец очереди,
            // а затем проигравшие
            winners.forEach(player => {
                // Сбрасываем счетчик побед
                delete consecutiveWins[player.id];
                queuePlayers.push(player);
            });

            losers.forEach(player => {
                // Сбрасываем счетчик побед для проигравших (на всякий случай)
                delete consecutiveWins[player.id];
                queuePlayers.push(player);
            });

            // Очищаем корт
            court.side1 = [];
            court.side2 = [];
        } else {
            // Если это первая победа, победители остаются на корте
            // и получают отметку о первой победе
            winners.forEach(player => {
                // Отмечаем, что у игрока есть победа
                consecutiveWins[player.id] = true;
            });

            // Проигравшие уходят в конец очереди
            losers.forEach(player => {
                // Сбрасываем счетчик побед для проигравших (на всякий случай)
                delete consecutiveWins[player.id];
                queuePlayers.push(player);
            });

            // Победители всегда перемещаются на верхнюю половину корта (side1)
            court.side1 = [...winners]; // Создаем копию массива
            court.side2 = [];
        }
    } else if (gameMode === 'winner-stays') {
        // Режим "Победитель остается всегда" - победители остаются на корте,
        // проигравшие отправляются в конец очереди

        // Отправляем проигравших в конец очереди
        losers.forEach(player => {
            // Сбрасываем счетчик побед для проигравших
            delete consecutiveWins[player.id];
            queuePlayers.push(player);
        });

        // Увеличиваем счетчик побед для победителей
        winners.forEach(player => {
            // Если у игрока уже есть победы, увеличиваем счетчик
            if (consecutiveWins[player.id]) {
                consecutiveWins[player.id]++;
            } else {
                // Иначе устанавливаем счетчик в 1
                consecutiveWins[player.id] = 1;
            }
        });

        // Возвращаем победителей на корт
        if (winningSide === 1) {
            court.side1 = [...winners]; // Создаем копию массива
            court.side2 = [];
        } else {
            court.side1 = [];
            court.side2 = [...winners]; // Создаем копию массива
        }
    }

    // Очищаем корт только если это режим "Играем один раз"
    // В других режимах мы уже обработали корт выше
    if (gameMode === 'play-once') {
        court.side1 = [];
        court.side2 = [];
    }

    // Обновляем отображение
    renderCourts();
    renderQueue();

    // Сохраняем состояние тренировки в Supabase после завершения игры
    saveTrainingState();
}

// Обработчик для кнопки возврата к списку тренировок
backToMainBtn.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// Обработчик для выбора режима игры
gameModeSelect.addEventListener('change', function() {
    gameMode = this.value;
    console.log(`Выбран режим игры: ${gameMode}`);

    // Сохраняем состояние тренировки в Supabase при изменении режима игры
    saveTrainingState();
});

// Функция для отображения индикатора загрузки
function showLoadingIndicator() {
    // Создаем элемент индикатора загрузки, если его еще нет
    if (!document.getElementById('loading-indicator')) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Сохранение данных...</div>
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

// Функция для сохранения состояния тренировки в Supabase
async function saveTrainingState() {
    // Показываем индикатор загрузки
    showLoadingIndicator();

    try {
        // Создаем объект с текущим состоянием тренировки
        const trainingState = {
            currentTraining,
            courtsData,
            queuePlayers,
            consecutiveWins,
            gameMode,
            gameTimers: {}, // Не сохраняем сами таймеры, только их состояние
            gameStartTimes: {} // Сохраняем время начала игр
        };

        // Для каждого активного таймера сохраняем время начала
        Object.keys(gameTimers).forEach(courtId => {
            trainingState.gameStartTimes[courtId] = gameStartTimes[courtId];
        });

        // Сохраняем состояние в Supabase
        const { data, error } = await supabase
            .from('training_states')
            .upsert(
                {
                    training_id: trainingId,
                    state: trainingState
                },
                { onConflict: 'training_id' }
            );

        if (error) throw error;

        console.log('Состояние тренировки сохранено в Supabase');

        // Также сохраняем в localStorage как резервную копию
        localStorage.setItem(`training_state_${trainingId}`, JSON.stringify(trainingState));
    } catch (error) {
        console.error('Ошибка при сохранении состояния тренировки:', error);

        // Показываем уведомление об ошибке
        alert('Не удалось сохранить состояние тренировки на сервере. Данные сохранены локально.');

        // Сохраняем в localStorage как резервную копию
        const trainingState = {
            currentTraining,
            courtsData,
            queuePlayers,
            consecutiveWins,
            gameMode,
            gameStartTimes: { ...gameStartTimes }
        };
        localStorage.setItem(`training_state_${trainingId}`, JSON.stringify(trainingState));
    } finally {
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
    }
}

// Функция для загрузки состояния тренировки из Supabase
async function loadTrainingState() {
    // Показываем индикатор загрузки
    showLoadingIndicator();

    try {
        // Пытаемся загрузить состояние из Supabase
        const { data, error } = await supabase
            .from('training_states')
            .select('state')
            .eq('training_id', trainingId)
            .single();

        if (error) {
            // Если ошибка не связана с отсутствием данных, выбрасываем её
            if (error.code !== 'PGRST116') {
                throw error;
            }

            // Если данных нет в Supabase, пытаемся загрузить из localStorage
            return loadTrainingStateFromLocalStorage();
        }

        if (data && data.state) {
            // Восстанавливаем состояние тренировки из Supabase
            const state = data.state;

            // Восстанавливаем состояние тренировки
            currentTraining = state.currentTraining;
            courtsData = state.courtsData;
            queuePlayers = state.queuePlayers;
            consecutiveWins = state.consecutiveWins || {};
            gameMode = state.gameMode || 'play-once';

            // Устанавливаем выбранный режим игры в селекте
            gameModeSelect.value = gameMode;

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

            console.log('Состояние тренировки загружено из Supabase');
            return true;
        }

        return false;
    } catch (error) {
        console.error('Ошибка при загрузке состояния тренировки из Supabase:', error);

        // Пытаемся загрузить из localStorage как резервную копию
        return loadTrainingStateFromLocalStorage();
    } finally {
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
    }
}

// Функция для загрузки состояния тренировки из localStorage (резервная копия)
function loadTrainingStateFromLocalStorage() {
    // Получаем сохраненное состояние из localStorage
    const savedState = localStorage.getItem(`training_state_${trainingId}`);

    if (savedState) {
        try {
            // Парсим сохраненное состояние
            const state = JSON.parse(savedState);

            // Восстанавливаем состояние тренировки
            currentTraining = state.currentTraining;
            courtsData = state.courtsData;
            queuePlayers = state.queuePlayers;
            consecutiveWins = state.consecutiveWins || {};
            gameMode = state.gameMode || 'play-once';

            // Устанавливаем выбранный режим игры в селекте
            gameModeSelect.value = gameMode;

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

            console.log('Состояние тренировки загружено из localStorage');
            return true;
        } catch (error) {
            console.error('Ошибка при загрузке состояния тренировки из localStorage:', error);
        }
    }

    return false;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Пытаемся загрузить сохраненное состояние
        const stateLoaded = await loadTrainingState();

        // Если состояние не было загружено, загружаем данные из Supabase
        if (!stateLoaded) {
            await loadData();
        }
    } catch (error) {
        console.error('Ошибка при инициализации тренировки:', error);
        alert('Произошла ошибка при загрузке данных. Пожалуйста, обновите страницу.');
    }

    // Добавляем обработчик для сохранения состояния при закрытии страницы
    window.addEventListener('beforeunload', function() {
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

        // Асинхронное сохранение в Supabase может не успеть выполниться перед закрытием страницы,
        // поэтому мы полагаемся на localStorage в этом случае
    });
});