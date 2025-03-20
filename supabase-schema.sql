-- Создание таблицы для игроков
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы для тренировок
CREATE TABLE trainings (
  id SERIAL PRIMARY KEY,
  location TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  courts INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание связующей таблицы между игроками и тренировками
CREATE TABLE training_players (
  id SERIAL PRIMARY KEY,
  training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(training_id, player_id)
);

-- Создание политик безопасности на уровне строк (RLS)
-- Включаем RLS для всех таблиц
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_players ENABLE ROW LEVEL SECURITY;

-- Создаем политики для анонимного доступа (для демонстрации)
-- В реальном приложении вы, вероятно, захотите ограничить доступ
CREATE POLICY "Анонимный доступ к игрокам" ON players FOR ALL USING (true);
CREATE POLICY "Анонимный доступ к тренировкам" ON trainings FOR ALL USING (true);
CREATE POLICY "Анонимный доступ к связям игрок-тренировка" ON training_players FOR ALL USING (true);