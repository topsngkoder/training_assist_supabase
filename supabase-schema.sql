-- Создание таблицы для хранения состояния тренировок
CREATE TABLE IF NOT EXISTS training_states (
    id SERIAL PRIMARY KEY,
    training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(training_id)
);

-- Создание индекса для быстрого поиска по training_id
CREATE INDEX IF NOT EXISTS idx_training_states_training_id ON training_states(training_id);

-- Создание триггера для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_training_states_updated_at
BEFORE UPDATE ON training_states
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();