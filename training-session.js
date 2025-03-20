// Импортируем клиент Supabase
import supabase from './supabase.js';

// Переменные для хранения данных
let players = [];
let trainings = [];

// Получаем ID тренировки из URL
const urlParams = new URLSearchParams(window.location.search);
const trainingId = parseInt(urlParams.get('id'));

// Данные текущей тренировки
let currentTraining = null;
let courtsData = [];
let queuePlayers = [];

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

// Создаем дефолтное изображение
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

const defaultAvatarURL = createDefaultAvatar();

// Загрузка данных из Supabase
async function loadData() {
    try {
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
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        alert('Произошла ошибка при загрузке данных. Пожалуйста, попробуйте позже.');
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
        
        // Создаем HTML для игроков на стороне 1
        let side1PlayersHtml = '';
        if (court.side1.length > 0) {
            court.side1.forEach(player => {
                const photoSrc = player.photo || defaultAvatarURL;
                side1PlayersHtml += `
                    <div class="court-player">
                        <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="court-player-photo">
                        <div class="player-name-container">
                            <div>${player.firstName} ${player.lastName}</div>
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
                const photoSrc = player.photo || defaultAvatarURL;
                side2PlayersHtml += `
                    <div class="court-player">
                        <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="court-player-photo">
                        <div class="player-name-container">
                            <div>${player.firstName} ${player.lastName}</div>
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

        const photoSrc = player.photo || defaultAvatarURL;

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

    // Перерисовываем корты, чтобы снять ограничения на изменение состава игроков
    renderCourts();
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
        // Режим "Не более двух раз" - будет реализован позже
        // Пока используем логику "Играем один раз"
        winners.forEach(player => {
            queuePlayers.push(player);
        });

        losers.forEach(player => {
            queuePlayers.push(player);
        });
    } else if (gameMode === 'winner-stays') {
        // Режим "Победитель остается всегда" - будет реализован позже
        // Пока используем логику "Играем один раз"
        winners.forEach(player => {
            queuePlayers.push(player);
        });

        losers.forEach(player => {
            queuePlayers.push(player);
        });
    }

    // Очищаем корт
    court.side1 = [];
    court.side2 = [];

    // Обновляем отображение
    renderCourts();
    renderQueue();
}

// Обработчик для кнопки возврата к списку тренировок
backToMainBtn.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// Обработчик для выбора режима игры
gameModeSelect.addEventListener('change', function() {
    gameMode = this.value;
    console.log(`Выбран режим игры: ${gameMode}`);
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем данные из Supabase
    loadData();
});