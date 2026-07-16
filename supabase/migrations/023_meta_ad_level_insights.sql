-- Ad-level daily Meta insights (vs client-level rollup in meta_ad_snapshots)
CREATE TABLE IF NOT EXISTS meta_ad_level_insights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_id          TEXT NOT NULL,
  ad_name        TEXT,
  adset_id       TEXT,
  adset_name     TEXT,
  campaign_id    TEXT,
  campaign_name  TEXT,
  date           DATE NOT NULL,
  spend          NUMERIC DEFAULT 0,
  impressions    INTEGER DEFAULT 0,
  reach          INTEGER DEFAULT 0,
  clicks         INTEGER DEFAULT 0,
  leads          INTEGER DEFAULT 0,
  synced_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, ad_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mali_client_date   ON meta_ad_level_insights(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mali_ad_name        ON meta_ad_level_insights(ad_name);
CREATE INDEX IF NOT EXISTS idx_mali_campaign       ON meta_ad_level_insights(campaign_name);
CREATE INDEX IF NOT EXISTS idx_mali_adset          ON meta_ad_level_insights(adset_name);

-- Current effective status per ad (refreshed on every sync)
CREATE TABLE IF NOT EXISTS meta_ad_statuses (
  ad_id            TEXT    NOT NULL,
  client_id        UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_name          TEXT,
  adset_id         TEXT,
  adset_name       TEXT,
  campaign_id      TEXT,
  campaign_name    TEXT,
  status           TEXT,   -- ACTIVE | PAUSED | DELETED | ARCHIVED
  effective_status TEXT,   -- actual delivery status from Meta
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ad_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_mas_client ON meta_ad_statuses(client_id);
