import os
from apps.api.app.adapters.base import DatabaseAdapter, global_event_broadcaster
from apps.api.app.adapters.in_memory import InMemoryDatabaseAdapter

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")):
    from apps.api.app.adapters.postgres_adapter import PostgresDatabaseAdapter
    db: DatabaseAdapter = PostgresDatabaseAdapter(database_url=DATABASE_URL)
else:
    db: DatabaseAdapter = InMemoryDatabaseAdapter()
