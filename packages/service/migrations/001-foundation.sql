CREATE TABLE environments (
  name text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_version integer NOT NULL DEFAULT 0 CHECK (base_version >= 0),
  active_version integer NOT NULL DEFAULT 0 CHECK (active_version >= 0),
  draft text NOT NULL DEFAULT '[]',
  archived_flags text NOT NULL DEFAULT '[]',
  archived boolean NOT NULL DEFAULT false
);

CREATE TABLE publications (
  environment text NOT NULL REFERENCES environments(name),
  version integer NOT NULL CHECK (version > 0),
  canonical text NOT NULL,
  digest text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  PRIMARY KEY (environment, version),
  UNIQUE (environment, idempotency_key)
);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  environment text NOT NULL REFERENCES environments(name),
  actor text NOT NULL,
  action text NOT NULL,
  revision integer NOT NULL,
  version integer NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published configuration and audit history are immutable';
END;
$$;
CREATE TRIGGER immutable_publications BEFORE UPDATE OR DELETE ON publications FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
