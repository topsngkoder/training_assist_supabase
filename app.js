// Импортируем клиент Supabase
import supabase from './supabase.js';

// Создаем дефолтное изображение
const defaultAvatarDataURL = createDefaultAvatar();

// Инициализация данных
let players = [];
let trainings = [];
let currentSortMethod = 'name'; // По умолчанию сортировка по имени
let activeTab = 'players'; // По умолчанию активна вкладка игроков

// DOM элементы
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const addPlayerBtn = document.getElementById('add-player-btn');
const addTrainingBtn = document.getElementById('add-training-btn');
const addPlayerToTrainingBtn = document.getElementById('add-player-to-training-btn');
const sortNameBtn = document.getElementById('sort-name-btn');
const sortRatingBtn = document.getElementById('sort-rating-btn');
const playerModal = document.getElementById('player-modal');
const trainingModal = document.getElementById('training-modal');
const closeBtns = document.querySelectorAll('.close-btn');
const playerForm = document.getElementById('player-form');
const trainingForm = document.getElementById('training-form');
const playersList = document.getElementById('players-list');
const trainingsList = document.getElementById('trainings-list');
const modalTitle = document.getElementById('modal-title');
const trainingModalTitle = document.getElementById('training-modal-title');
const playerIndex = document.getElementById('player-index');
const trainingIndex = document.getElementById('training-index');
const currentPhotoContainer = document.getElementById('current-photo-container');
const currentPhoto = document.getElementById('current-photo');
const trainingPlayersSelection = document.getElementById('training-players-selection');

// Переменная для хранения информации о текущей тренировке при создании игрока
let currentTrainingData = null;

// Переменная для хранения пути к старой фотографии (для удаления при обновлении)
let oldPhotoPath = null;

// Функция для создания аватара с инициалами
function createInitialsAvatar(firstName, lastName) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Получаем инициалы
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    const initials = firstInitial + lastInitial;

    // Генерируем цвет фона на основе имени
    const hue = Math.abs(firstName.length * 10 + lastName.length * 7) % 360;
    const bgColor = `hsl(${hue}, 70%, 60%)`;

    // Создаем круглый фон
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.fill();

    // Рисуем инициалы
    ctx.fillStyle = 'white';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 100);

    // Возвращаем как data URL
    return canvas.toDataURL('image/png');
}

// Функция для создания дефолтного аватара (для обратной совместимости)
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

// Загрузка данных из Supabase
async function loadData() {
    try {
        // Загружаем игроков
        const { data: playersData, error: playersError } = await supabase
            .from('players')
            .select('*')
            .order('first_name', { ascending: true });
        
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
            .select('*')
            .order('date', { ascending: false });
        
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
        
        // Отображаем данные
        renderPlayers();
        renderTrainings();
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        alert('Произошла ошибка при загрузке данных. Пожалуйста, попробуйте позже.');
    }
}

// Отображение списка игроков
function renderPlayers() {
    playersList.innerHTML = '';

    if (players.length === 0) {
        playersList.innerHTML = '<p class="no-players">Нет добавленных игроков</p>';
        return;
    }

    // Сортировка игроков
    const sortedPlayers = [...players];
    if (currentSortMethod === 'name') {
        sortedPlayers.sort((a, b) => {
            const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });
    } else if (currentSortMethod === 'rating') {
        sortedPlayers.sort((a, b) => b.rating - a.rating);
    }

    sortedPlayers.forEach((player) => {
        const playerCard = document.createElement('div');
        playerCard.classList.add('player-card');

        // Если у игрока нет фото, создаем аватар с инициалами
        const photoSrc = player.photo || createInitialsAvatar(player.firstName, player.lastName);

        playerCard.innerHTML = `
            <div class="player-card-content">
                <div class="player-info">
                    <h3>${player.firstName} ${player.lastName}</h3>
                    <p class="player-rating">Рейтинг: ${player.rating}</p>
                    <div class="player-actions">
                        <button class="btn edit-btn" data-id="${player.id}">Редактировать</button>
                        <button class="btn delete-btn" data-id="${player.id}">Удалить</button>
                    </div>
                </div>
                <div class="player-photo-container">
                    <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="player-photo">
                </div>
            </div>
        `;

        playersList.appendChild(playerCard);
    });

    // Добавляем обработчики для кнопок
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            deletePlayer(id);
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            openEditPlayerModal(id);
        });
    });
}

// Добавление нового игрока
async function addPlayer(playerData) {
    try {
        // Добавляем игрока в Supabase
        const { data, error } = await supabase
            .from('players')
            .insert({
                first_name: playerData.firstName,
                last_name: playerData.lastName,
                rating: playerData.rating,
                photo: playerData.photo
            })
            .select();
        
        if (error) throw error;
        
        // Добавляем игрока в локальный массив
        const newPlayer = {
            id: data[0].id,
            firstName: data[0].first_name,
            lastName: data[0].last_name,
            rating: data[0].rating,
            photo: data[0].photo
        };
        
        players.push(newPlayer);
        
        // Если игрок был создан из формы тренировки, добавляем его в тренировку
        if (currentTrainingData) {
            // Находим индекс нового игрока в массиве players
            const playerIndex = players.length - 1;
            
            // Добавляем связь между тренировкой и игроком
            if (currentTrainingData.id) {
                await supabase
                    .from('training_players')
                    .insert({
                        training_id: currentTrainingData.id,
                        player_id: newPlayer.id
                    });
                
                // Обновляем локальные данные
                const trainingIndex = trainings.findIndex(t => t.id === currentTrainingData.id);
                if (trainingIndex !== -1) {
                    if (!trainings[trainingIndex].playerIds) {
                        trainings[trainingIndex].playerIds = [];
                    }
                    trainings[trainingIndex].playerIds.push(playerIndex);
                }
            }
        }
        
        renderPlayers();
        return newPlayer;
    } catch (error) {
        console.error('Ошибка при добавлении игрока:', error);
        alert('Произошла ошибка при добавлении игрока. Пожалуйста, попробуйте позже.');
        return null;
    }
}

// Удаление игрока
async function deletePlayer(id) {
    if (confirm('Вы уверены, что хотите удалить этого игрока?')) {
        try {
            // Удаляем игрока из Supabase
            const { error } = await supabase
                .from('players')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Удаляем игрока из локального массива
            const playerIndex = players.findIndex(p => p.id === id);
            if (playerIndex !== -1) {
                players.splice(playerIndex, 1);
            }
            
            // Обновляем тренировки, удаляя ссылки на удаленного игрока
            trainings.forEach(training => {
                if (training.playerIds) {
                    training.playerIds = training.playerIds.filter(idx => idx !== playerIndex);
                }
            });
            
            renderPlayers();
            renderTrainings();
        } catch (error) {
            console.error('Ошибка при удалении игрока:', error);
            alert('Произошла ошибка при удалении игрока. Пожалуйста, попробуйте позже.');
        }
    }
}

// Обновление игрока
async function updatePlayer(id, playerData) {
    try {
        // Обновляем игрока в Supabase
        const { error } = await supabase
            .from('players')
            .update({
                first_name: playerData.firstName,
                last_name: playerData.lastName,
                rating: playerData.rating,
                photo: playerData.photo
            })
            .eq('id', id);
        
        if (error) throw error;
        
        // Обновляем игрока в локальном массиве
        const playerIndex = players.findIndex(p => p.id === id);
        if (playerIndex !== -1) {
            players[playerIndex] = {
                ...players[playerIndex],
                firstName: playerData.firstName,
                lastName: playerData.lastName,
                rating: playerData.rating,
                photo: playerData.photo
            };
        }
        
        renderPlayers();
    } catch (error) {
        console.error('Ошибка при обновлении игрока:', error);
        alert('Произошла ошибка при обновлении игрока. Пожалуйста, попробуйте позже.');
    }
}

// Переключение вкладок
function switchTab(tabName) {
    activeTab = tabName;

    // Обновляем активные кнопки вкладок
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Обновляем видимость контента вкладок
    tabContents.forEach(content => {
        const isActive = content.id === `${tabName}-tab`;
        content.classList.toggle('active', isActive);
    });
}

// Отображение списка тренировок
function renderTrainings() {
    trainingsList.innerHTML = '';

    if (trainings.length === 0) {
        trainingsList.innerHTML = '<p class="no-players">Нет созданных тренировок</p>';
        return;
    }

    // Сортировка тренировок по дате (сначала новые)
    const sortedTrainings = [...trainings].sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB - dateA;
    });

    sortedTrainings.forEach((training) => {
        const trainingCard = document.createElement('div');
        trainingCard.classList.add('training-card');

        // Форматирование даты
        const trainingDate = new Date(`${training.date}T${training.time}`);
        const formattedDate = trainingDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const formattedTime = training.time;

        // Создаем HTML для списка игроков
        let playersHtml = '';
        if (training.playerIds && training.playerIds.length > 0) {
            training.playerIds.forEach(playerIndex => {
                const player = players[playerIndex];
                if (player) {
                    // Если у игрока нет фото, создаем аватар с инициалами
                    const photoSrc = player.photo || createInitialsAvatar(player.firstName, player.lastName);
                    playersHtml += `
                        <div class="training-player-item">
                            <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="training-player-photo">
                            <div>${player.firstName} ${player.lastName}</div>
                        </div>
                    `;
                }
            });
        } else {
            playersHtml = '<p>Нет участников</p>';
        }

        trainingCard.innerHTML = `
            <div class="training-header">
                <div class="training-date-time">${formattedDate}, ${formattedTime}</div>
                <div class="training-actions">
                    <button class="btn edit-btn" data-id="${training.id}">Редактировать</button>
                    <button class="btn delete-btn" data-id="${training.id}">Удалить</button>
                </div>
            </div>
            <div class="training-info">
                <div class="training-details">
                    <div class="training-location">
                        <strong>Место:</strong> ${training.location}
                    </div>
                    <div class="training-courts">
                        <strong>Количество кортов:</strong> ${training.courts}
                    </div>
                </div>
                <button class="btn start-training-btn blue-btn" data-id="${training.id}">Войти</button>
            </div>
            <div class="training-players-title">Участники:</div>
            <div class="training-players">
                ${playersHtml}
            </div>
        `;

        trainingsList.appendChild(trainingCard);
    });

    // Добавляем обработчики для кнопок
    document.querySelectorAll('.trainings-list .delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            deleteTraining(id);
        });
    });

    document.querySelectorAll('.trainings-list .edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            openEditTrainingModal(id);
        });
    });

    document.querySelectorAll('.trainings-list .start-training-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            window.location.href = `training-session.html?id=${id}`;
        });
    });
}

// Добавление новой тренировки
async function addTraining(trainingData) {
    try {
        // Добавляем тренировку в Supabase
        const { data, error } = await supabase
            .from('trainings')
            .insert({
                location: trainingData.location,
                date: trainingData.date,
                time: trainingData.time,
                courts: trainingData.courts
            })
            .select();
        
        if (error) throw error;
        
        // Добавляем тренировку в локальный массив
        const newTraining = {
            id: data[0].id,
            location: data[0].location,
            date: data[0].date,
            time: data[0].time,
            courts: data[0].courts,
            playerIds: []
        };
        
        trainings.push(newTraining);
        
        // Если есть выбранные игроки, добавляем их в тренировку
        if (trainingData.playerIds && trainingData.playerIds.length > 0) {
            const trainingPlayersData = trainingData.playerIds.map(playerIndex => ({
                training_id: newTraining.id,
                player_id: players[playerIndex].id
            }));
            
            const { error: tpError } = await supabase
                .from('training_players')
                .insert(trainingPlayersData);
            
            if (tpError) throw tpError;
            
            newTraining.playerIds = trainingData.playerIds;
        }
        
        renderTrainings();
        return newTraining;
    } catch (error) {
        console.error('Ошибка при добавлении тренировки:', error);
        alert('Произошла ошибка при добавлении тренировки. Пожалуйста, попробуйте позже.');
        return null;
    }
}

// Удаление тренировки
async function deleteTraining(id) {
    if (confirm('Вы уверены, что хотите удалить эту тренировку?')) {
        try {
            // Удаляем тренировку из Supabase
            const { error } = await supabase
                .from('trainings')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Удаляем тренировку из локального массива
            const trainingIndex = trainings.findIndex(t => t.id === id);
            if (trainingIndex !== -1) {
                trainings.splice(trainingIndex, 1);
            }
            
            renderTrainings();
        } catch (error) {
            console.error('Ошибка при удалении тренировки:', error);
            alert('Произошла ошибка при удалении тренировки. Пожалуйста, попробуйте позже.');
        }
    }
}

// Обновление тренировки
async function updateTraining(id, trainingData) {
    try {
        // Обновляем тренировку в Supabase
        const { error } = await supabase
            .from('trainings')
            .update({
                location: trainingData.location,
                date: trainingData.date,
                time: trainingData.time,
                courts: trainingData.courts
            })
            .eq('id', id);
        
        if (error) throw error;
        
        // Обновляем тренировку в локальном массиве
        const trainingIndex = trainings.findIndex(t => t.id === id);
        if (trainingIndex !== -1) {
            trainings[trainingIndex] = {
                ...trainings[trainingIndex],
                location: trainingData.location,
                date: trainingData.date,
                time: trainingData.time,
                courts: trainingData.courts
            };
            
            // Обновляем связи с игроками
            if (trainingData.playerIds) {
                // Удаляем все существующие связи
                const { error: deleteError } = await supabase
                    .from('training_players')
                    .delete()
                    .eq('training_id', id);
                
                if (deleteError) throw deleteError;
                
                // Добавляем новые связи
                if (trainingData.playerIds.length > 0) {
                    const trainingPlayersData = trainingData.playerIds.map(playerIndex => ({
                        training_id: id,
                        player_id: players[playerIndex].id
                    }));
                    
                    const { error: insertError } = await supabase
                        .from('training_players')
                        .insert(trainingPlayersData);
                    
                    if (insertError) throw insertError;
                }
                
                trainings[trainingIndex].playerIds = trainingData.playerIds;
            }
        }
        
        renderTrainings();
    } catch (error) {
        console.error('Ошибка при обновлении тренировки:', error);
        alert('Произошла ошибка при обновлении тренировки. Пожалуйста, попробуйте позже.');
    }
}

// Открытие модального окна для редактирования тренировки
function openEditTrainingModal(id) {
    const training = trainings.find(t => t.id === id);
    if (!training) return;

    // Заполняем форму данными тренировки
    document.getElementById('training-location').value = training.location;
    document.getElementById('training-date').value = training.date;
    document.getElementById('training-time').value = training.time;
    document.getElementById('training-courts').value = training.courts;
    trainingIndex.value = id;

    // Сохраняем данные текущей тренировки
    currentTrainingData = {
        id: id,
        location: training.location,
        date: training.date,
        time: training.time,
        courts: training.courts,
        playerIds: training.playerIds || []
    };

    // Заполняем список игроков
    fillTrainingPlayersSelection(training.playerIds || []);

    // Меняем заголовок модального окна
    trainingModalTitle.textContent = 'Редактировать тренировку';

    // Открываем модальное окно
    trainingModal.style.display = 'block';
}

// Открытие модального окна для создания игрока из формы тренировки
function openAddPlayerFromTrainingModal() {
    // Сохраняем данные текущей тренировки
    currentTrainingData = {
        id: trainingIndex.value ? parseInt(trainingIndex.value) : null,
        location: document.getElementById('training-location').value,
        date: document.getElementById('training-date').value,
        time: document.getElementById('training-time').value,
        courts: parseInt(document.getElementById('training-courts').value),
        playerIds: Array.from(document.querySelectorAll('input[name="selected-players"]:checked'))
            .map(checkbox => parseInt(checkbox.value))
    };

    // Сбрасываем форму игрока и скрываем контейнер с текущим фото
    playerForm.reset();
    playerIndex.value = '';
    currentPhotoContainer.style.display = 'none';

    // Меняем заголовок модального окна
    modalTitle.textContent = 'Добавить игрока';

    // Скрываем модальное окно тренировки и открываем модальное окно игрока
    trainingModal.style.display = 'none';
    playerModal.style.display = 'block';
}

// Заполнение списка игроков для выбора в тренировку
function fillTrainingPlayersSelection(selectedPlayerIds = []) {
    trainingPlayersSelection.innerHTML = '';

    if (players.length === 0) {
        trainingPlayersSelection.innerHTML = '<p>Нет доступных игроков</p>';
        return;
    }

    players.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-checkbox-item');

        // Если у игрока нет фото, создаем аватар с инициалами
        const photoSrc = player.photo || createInitialsAvatar(player.firstName, player.lastName);
        const isChecked = selectedPlayerIds.includes(index);

        playerItem.innerHTML = `
            <input type="checkbox" id="player-${index}" name="selected-players" value="${index}" ${isChecked ? 'checked' : ''}>
            <img src="${photoSrc}" alt="${player.firstName} ${player.lastName}" class="player-checkbox-photo">
            <div class="player-checkbox-info">
                <label for="player-${index}">${player.firstName} ${player.lastName} (Рейтинг: ${player.rating})</label>
            </div>
        `;

        trainingPlayersSelection.appendChild(playerItem);
    });
}

// Открытие модального окна для редактирования игрока
function openEditPlayerModal(id) {
    const player = players.find(p => p.id === id);
    if (!player) return;

    // Заполняем форму данными игрока
    document.getElementById('first-name').value = player.firstName;
    document.getElementById('last-name').value = player.lastName;
    document.getElementById('rating').value = player.rating;
    playerIndex.value = id;

    // Отображаем текущее фото, если оно есть
    if (player.photo) {
        currentPhotoContainer.style.display = 'block';
        currentPhoto.src = player.photo;
    } else {
        currentPhotoContainer.style.display = 'none';
    }

    // Меняем заголовок модального окна
    modalTitle.textContent = 'Редактировать игрока';

    // Открываем модальное окно
    playerModal.style.display = 'block';
}

// Обработка отправки формы игрока
playerForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const firstName = document.getElementById('first-name').value;
    const lastName = document.getElementById('last-name').value;
    const rating = parseInt(document.getElementById('rating').value);
    const photoInput = document.getElementById('photo');
    const id = playerIndex.value ? parseInt(playerIndex.value) : null;

    // Функция для сохранения игрока
    const savePlayer = async (photoData) => {
        const playerData = {
            firstName,
            lastName,
            rating,
            photo: photoData
        };

        if (id !== null) {
            // Редактирование существующего игрока
            await updatePlayer(id, playerData);

            // Если это обновление и у игрока было старое фото, удаляем его
            if (id !== null && oldPhotoPath) {
                try {
                    // Удаляем старое фото из хранилища
                    const { error: deleteError } = await supabase.storage
                        .from('player-photos')
                        .remove([oldPhotoPath]);

                    if (deleteError) {
                        console.warn('Не удалось удалить старое фото:', deleteError);
                    }
                } catch (deleteErr) {
                    console.warn('Ошибка при удалении старого фото:', deleteErr);
                }
            }
        } else {
            // Добавление нового игрока
            await addPlayer(playerData);
        }

        // Закрываем модальное окно
        playerModal.style.display = 'none';

        // Если игрок был создан из формы тренировки, возвращаемся к ней
        if (currentTrainingData) {
            // Обновляем список игроков в форме тренировки
            fillTrainingPlayersSelection(currentTrainingData.playerIds);
            
            // Открываем модальное окно тренировки
            trainingModal.style.display = 'block';
            
            // Сбрасываем данные текущей тренировки
            currentTrainingData = null;
        }
    };

    // Проверяем, загружено ли новое фото
    if (photoInput.files && photoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            await savePlayer(e.target.result);
        };
        reader.readAsDataURL(photoInput.files[0]);
    } else {
        // Если фото не изменилось, используем текущее или null
        const currentPhotoData = id !== null && players.find(p => p.id === id)?.photo;
        await savePlayer(currentPhotoData);
    }
});

// Обработка отправки формы тренировки
trainingForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const location = document.getElementById('training-location').value;
    const date = document.getElementById('training-date').value;
    const time = document.getElementById('training-time').value;
    const courts = parseInt(document.getElementById('training-courts').value);
    const id = trainingIndex.value ? parseInt(trainingIndex.value) : null;
    
    // Получаем выбранных игроков
    const selectedPlayerIds = Array.from(document.querySelectorAll('input[name="selected-players"]:checked'))
        .map(checkbox => parseInt(checkbox.value));

    const trainingData = {
        location,
        date,
        time,
        courts,
        playerIds: selectedPlayerIds
    };

    if (id !== null) {
        // Редактирование существующей тренировки
        await updateTraining(id, trainingData);
    } else {
        // Добавление новой тренировки
        await addTraining(trainingData);
    }

    // Закрываем модальное окно
    trainingModal.style.display = 'none';
});

// Обработчики событий

// Переключение вкладок
tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        switchTab(tabName);
    });
});

// Открытие модальных окон
addPlayerBtn.addEventListener('click', function() {
    playerForm.reset();
    playerIndex.value = '';
    currentPhotoContainer.style.display = 'none';
    modalTitle.textContent = 'Добавить игрока';
    playerModal.style.display = 'block';
    currentTrainingData = null;
});

addTrainingBtn.addEventListener('click', function() {
    trainingForm.reset();
    trainingIndex.value = '';
    fillTrainingPlayersSelection();
    trainingModalTitle.textContent = 'Создать тренировку';
    trainingModal.style.display = 'block';
});

addPlayerToTrainingBtn.addEventListener('click', openAddPlayerFromTrainingModal);

// Закрытие модальных окон
closeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        modal.style.display = 'none';
        
        // Если закрываем модальное окно игрока, созданное из формы тренировки,
        // возвращаемся к форме тренировки
        if (modal === playerModal && currentTrainingData) {
            trainingModal.style.display = 'block';
            currentTrainingData = null;
        }
    });
});

// Закрытие модальных окон при клике вне их
window.addEventListener('click', function(e) {
    if (e.target === playerModal) {
        playerModal.style.display = 'none';
        
        // Если закрываем модальное окно игрока, созданное из формы тренировки,
        // возвращаемся к форме тренировки
        if (currentTrainingData) {
            trainingModal.style.display = 'block';
            currentTrainingData = null;
        }
    }
    
    if (e.target === trainingModal) {
        trainingModal.style.display = 'none';
    }
});

// Сортировка игроков
sortNameBtn.addEventListener('click', function() {
    currentSortMethod = 'name';
    renderPlayers();
    
    // Обновляем стили кнопок сортировки
    sortNameBtn.classList.add('active');
    sortRatingBtn.classList.remove('active');
});

sortRatingBtn.addEventListener('click', function() {
    currentSortMethod = 'rating';
    renderPlayers();
    
    // Обновляем стили кнопок сортировки
    sortNameBtn.classList.remove('active');
    sortRatingBtn.classList.add('active');
});

// Функция для предпросмотра фотографии
function previewPhoto(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        // Показываем контейнер с фото
        currentPhotoContainer.style.display = 'block';
        // Устанавливаем изображение для предпросмотра
        currentPhoto.src = e.target.result;
        // Добавляем класс для стилизации предпросмотра
        currentPhoto.classList.add('preview');
    }

    reader.readAsDataURL(file);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем данные из Supabase
    loadData();

    // Устанавливаем активную вкладку
    switchTab(activeTab);

    // Устанавливаем активную кнопку сортировки
    if (currentSortMethod === 'name') {
        sortNameBtn.classList.add('active');
    } else {
        sortRatingBtn.classList.add('active');
    }

    // Добавляем обработчик события изменения поля загрузки фото
    document.getElementById('photo').addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            // Проверяем тип файла
            const file = this.files[0];
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

            if (!validImageTypes.includes(fileType)) {
                alert('Пожалуйста, выберите изображение в формате JPEG, PNG, GIF или WebP');
                this.value = ''; // Очищаем поле
                return;
            }

            // Проверяем размер файла (максимум 2 МБ)
            const maxSize = 2 * 1024 * 1024; // 2 МБ в байтах
            if (file.size > maxSize) {
                alert('Размер файла не должен превышать 2 МБ');
                this.value = ''; // Очищаем поле
                return;
            }

            // Показываем предпросмотр
            previewPhoto(file);
        } else {
            // Скрываем контейнер с фото, если файл не выбран
            currentPhotoContainer.style.display = 'none';
        }
    });
});