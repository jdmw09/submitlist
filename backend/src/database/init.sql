-- TaskManager Database Initialization Script
-- This script runs automatically when the database is first created
-- All migrations in the migrations folder will be executed in alphabetical order

-- Ensure the database is using UTF-8
SET client_encoding = 'UTF8';

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Individual migration files will be executed automatically
-- by PostgreSQL's docker-entrypoint-initdb.d mechanism
