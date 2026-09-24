-- Makes the denormalised jurisdiction columns agree with their parents by
-- constraint, and gives readings.substation_id the FK it was missing.
-- Already contained in db/schema.sql; this brings an existing database level.

ALTER TABLE districts
  ADD UNIQUE KEY uq_districts_district_province (district_id, province_id);

ALTER TABLE grid_substations
  ADD UNIQUE KEY uq_substations_jurisdiction (substation_id, district_id, province_id),
  ADD CONSTRAINT fk_substations_district_province
    FOREIGN KEY (district_id, province_id)
    REFERENCES districts(district_id, province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE installations
  ADD CONSTRAINT fk_installations_substation_jurisdiction
    FOREIGN KEY (substation_id, district_id, province_id)
    REFERENCES grid_substations(substation_id, district_id, province_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE readings
  ADD KEY ix_readings_substation_time (substation_id, recorded_at),
  ADD CONSTRAINT fk_readings_substation
    FOREIGN KEY (substation_id)
    REFERENCES grid_substations(substation_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
