-- Seed test plans

INSERT INTO plans (name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players, is_active)
VALUES 
  ('Starter', 'Perfect for beginners and casual players', 4.99, 30, 2, 2.0, 10.0, 20, true),
  ('Standard', 'Great for growing communities', 9.99, 30, 4, 4.0, 20.0, 50, true),
  ('Professional', 'For serious server administrators', 14.99, 30, 6, 8.0, 50.0, 100, true),
  ('Enterprise', 'Maximum performance for large communities', 24.99, 30, 8, 16.0, 100.0, 500, true)
ON CONFLICT DO NOTHING;

-- Display inserted plans
SELECT * FROM plans WHERE is_active = true ORDER BY price ASC;
