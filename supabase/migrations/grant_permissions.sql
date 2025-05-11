-- Grant necessary permissions for holidays table
GRANT ALL PRIVILEGES ON TABLE holidays TO your_app_user;
GRANT USAGE, SELECT ON SEQUENCE holidays_id_seq TO your_app_user;

-- Grant necessary permissions for related tables
GRANT SELECT ON TABLE users TO your_app_user;
GRANT SELECT ON TABLE pegawai TO your_app_user;
