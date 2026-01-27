CREATE DATABASE versions_db;

CREATE USER versions_user WITH PASSWORD 'versions_pass';
GRANT ALL PRIVILEGES ON DATABASE versions_db TO versions_user;
