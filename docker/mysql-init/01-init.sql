-- Auto-runs on first MySQL boot (empty mysql_data volume).
-- Creates the three databases and grants appuser full access.
-- Safe to re-run — uses IF NOT EXISTS.

CREATE DATABASE IF NOT EXISTS finance_fina  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS auth_fina     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS insights_fina CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON finance_fina.*  TO 'appuser'@'%';
GRANT ALL PRIVILEGES ON auth_fina.*     TO 'appuser'@'%';
GRANT ALL PRIVILEGES ON insights_fina.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
