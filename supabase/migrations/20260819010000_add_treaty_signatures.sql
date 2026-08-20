CREATE TABLE IF NOT EXISTS bem.eventgage_event_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES bem.eventgage_user(id) ON DELETE CASCADE,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eventgage_event_signatures_event_id
    ON bem.eventgage_event_signatures(event_id, signed_at);

ALTER TABLE bem.eventgage_event_signatures ENABLE ROW LEVEL SECURITY;
