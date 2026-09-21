
CREATE DATABASE IF NOT EXISTS slsea
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE slsea;

-- 1. Provinces

CREATE TABLE IF NOT EXISTS provinces (
  province_id  TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  name         VARCHAR(64) NOT NULL,
  code         CHAR(2) NOT NULL,
  capital      VARCHAR(64) NOT NULL,

  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_provinces_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. Districts

CREATE TABLE IF NOT EXISTS districts (
  district_id  TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  province_id  TINYINT UNSIGNED NOT NULL,
  name         VARCHAR(64) NOT NULL,
  code         CHAR(3) NOT NULL,

  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_districts_code (code),
  KEY ix_districts_province (province_id),

  CONSTRAINT fk_districts_province
    FOREIGN KEY (province_id)
    REFERENCES provinces(province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 3. Grid Substations

CREATE TABLE IF NOT EXISTS grid_substations (
  substation_id    SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  district_id      TINYINT UNSIGNED NOT NULL,
  province_id      TINYINT UNSIGNED NOT NULL,
  name             VARCHAR(96) NOT NULL,
  code             VARCHAR(16) NOT NULL,
  capacity_mva     DECIMAL(7,2) NOT NULL,
  voltage_level_kv SMALLINT UNSIGNED NOT NULL,
  latitude         DECIMAL(9,6) NOT NULL,
  longitude        DECIMAL(9,6) NOT NULL,

  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                   ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_substations_code (code),
  KEY ix_substations_district (district_id),
  KEY ix_substations_province (province_id),

  CONSTRAINT fk_substations_district
    FOREIGN KEY (district_id)
    REFERENCES districts(district_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_substations_province
    FOREIGN KEY (province_id)
    REFERENCES provinces(province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT ck_substations_capacity
    CHECK (capacity_mva > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. Solar Installations

CREATE TABLE IF NOT EXISTS installations (
  installation_id    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference          VARCHAR(32) NOT NULL,
  meter_id           VARCHAR(32) NOT NULL,
  inverter_id        VARCHAR(48) NOT NULL,
  device_secret_hash CHAR(60) NOT NULL,

  capacity_kw        DECIMAL(8,2) NOT NULL,
  panel_count        SMALLINT UNSIGNED NOT NULL,

  status             ENUM(
                       'active',
                       'inactive',
                       'decommissioned'
                     ) NOT NULL DEFAULT 'active',

  commissioned_on    DATE NOT NULL,
  address_line       VARCHAR(160) NOT NULL,

  latitude           DECIMAL(9,6) NOT NULL,
  longitude          DECIMAL(9,6) NOT NULL,

  substation_id      SMALLINT UNSIGNED NOT NULL,
  district_id        TINYINT UNSIGNED NOT NULL,
  province_id        TINYINT UNSIGNED NOT NULL,

  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_installations_meter (meter_id),
  UNIQUE KEY uq_installations_reference (reference),

  KEY ix_installations_substation (substation_id),
  KEY ix_installations_district_status (district_id, status),
  KEY ix_installations_province_status (province_id, status),

  CONSTRAINT fk_installations_substation
    FOREIGN KEY (substation_id)
    REFERENCES grid_substations(substation_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_installations_district
    FOREIGN KEY (district_id)
    REFERENCES districts(district_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_installations_province
    FOREIGN KEY (province_id)
    REFERENCES provinces(province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT ck_installations_capacity
    CHECK (capacity_kw > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. Generation Readings

CREATE TABLE IF NOT EXISTS readings (
  reading_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  installation_id INT UNSIGNED NOT NULL,

  recorded_at     DATETIME(3) NOT NULL,
  ingested_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  power_kw        DECIMAL(9,3) NOT NULL,
  energy_kwh      DECIMAL(12,3) NOT NULL,
  voltage_v       DECIMAL(6,2) NOT NULL,

  -- Jurisdiction snapshot at the time of the reading
  substation_id   SMALLINT UNSIGNED NOT NULL,
  district_id     TINYINT UNSIGNED NOT NULL,
  province_id     TINYINT UNSIGNED NOT NULL,

  UNIQUE KEY uq_readings_natural (
    installation_id,
    recorded_at
  ),

  KEY ix_readings_district_time (
    district_id,
    recorded_at
  ),

  KEY ix_readings_province_time (
    province_id,
    recorded_at
  ),

  CONSTRAINT fk_readings_installation
    FOREIGN KEY (installation_id)
    REFERENCES installations(installation_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_readings_district
    FOREIGN KEY (district_id)
    REFERENCES districts(district_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_readings_province
    FOREIGN KEY (province_id)
    REFERENCES provinces(province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT ck_readings_power
    CHECK (
      power_kw >= 0
      AND power_kw <= 1000
    ),

  CONSTRAINT ck_readings_energy
    CHECK (energy_kwh >= 0),

  CONSTRAINT ck_readings_voltage
    CHECK (
      voltage_v >= 0
      AND voltage_v <= 500
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 6. Users

CREATE TABLE IF NOT EXISTS users (
  user_id            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,

  email              VARCHAR(160) NOT NULL,
  password_hash      CHAR(60) NOT NULL,
  full_name          VARCHAR(96) NOT NULL,

  role               ENUM(
                       'national_analyst',
                       'provincial_officer',
                       'district_officer',
                       'admin'
                     ) NOT NULL,

  jurisdiction_level ENUM(
                       'national',
                       'provincial',
                       'district'
                     ) NOT NULL,

  province_id        TINYINT UNSIGNED NULL,
  district_id        TINYINT UNSIGNED NULL,

  scopes             JSON NOT NULL,

  is_active          TINYINT(1) NOT NULL DEFAULT 1,

  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_users_email (email),

  CONSTRAINT fk_users_province
    FOREIGN KEY (province_id)
    REFERENCES provinces(province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_users_district
    FOREIGN KEY (district_id)
    REFERENCES districts(district_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 7. Schema Migrations

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(128) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
