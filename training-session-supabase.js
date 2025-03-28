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

// DOM элементы
const trainingInfoElement = document.getElementById('training-info');
const courtsContainer = document.getElementById('courts-container');
const playersQueue = document.getElementById('players-queue');
const backToMainBtn = document.getElementById('back-to-main');

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

const defaultAvatarDataURL = createDefaultAvatar();

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
        
        // Создаем HTML для игроков на стороне 1
        let side1PlayersHtml = '';
        if (court.side1.length > 0) {
            court.side1.forEach(player => {
                const photoSrc = player.photo || defaultAvatarDataURL;
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
        if (court.side2.length > 0) {
            court.side2.forEach(player => {
                const photoSrc = player.photo || defaultAvatarDataURL;
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
        
        courtCard.innerHTML = `
            <div class="court-header">
                <div class="court-title">${court.name}</div>
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
                <button class="btn finish-game-btn" data-court="${court.id}">Игра завершена</button>
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
    
    queuePlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('queue-player');
        
        const photoSrc = player.photo || defaultAvatarDataURL;
        
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

        const photoSrc = player.photo || defaultAvatarDataURL;

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

// Завершение игры на корте
function finishGame(courtId) {
    alert('Функционал завершения игры будет добавлен в следующей версии');
}

// Обработчик для кнопки возврата к списку тренировок
backToMainBtn.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем данные из Supabase
    loadData();
});