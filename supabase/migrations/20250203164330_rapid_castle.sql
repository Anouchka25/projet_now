-- Nettoyer les données existantes
TRUNCATE TABLE exchange_rates CASCADE;
TRUNCATE TABLE transfer_fees CASCADE;

-- Insérer les taux de change
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
-- EUR <-> XAF
('EUR', 'XAF', 655.96),
('XAF', 'EUR', 0.001524),  -- 1/655.96
-- EUR <-> CNY
('EUR', 'CNY', 7.5099),
('CNY', 'EUR', 0.133157),  -- 1/7.5099
-- XAF <-> CNY
('XAF', 'CNY', 0.011445),  -- 7.5099/655.96
('CNY', 'XAF', 87.34);     -- 655.96/7.5099

-- Insérer les frais de transfert
INSERT INTO transfer_fees (from_country, to_country, payment_method, receiving_method, fee_percentage) VALUES
-- Gabon -> Chine uniquement
('GA', 'CN', 'AIRTEL_MONEY', 'ALIPAY', 0.085),
('GA', 'CN', 'CASH', 'ALIPAY', 0.075),

-- France -> Gabon uniquement
('FR', 'GA', 'BANK_TRANSFER', 'AIRTEL_MONEY', 0.005),
('FR', 'GA', 'BANK_TRANSFER', 'CASH', 0.004),

-- Gabon -> France uniquement
('GA', 'FR', 'AIRTEL_MONEY', 'BANK_TRANSFER', 0.055),
('GA', 'FR', 'CASH', 'BANK_TRANSFER', 0.04);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_transfer_fees_countries ON transfer_fees(from_country, to_country, payment_method, receiving_method);

-- Mettre à jour les timestamps
UPDATE exchange_rates SET updated_at = now();
UPDATE transfer_fees SET updated_at = now();