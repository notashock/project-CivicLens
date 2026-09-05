import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from apps.api.app.adapters.base import DatabaseAdapter, global_event_broadcaster
from apps.api.app.adapters.in_memory import InMemoryDatabaseAdapter

# Search for .env at project root and current working directory
project_root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if project_root_env.exists():
    load_dotenv(dotenv_path=project_root_env)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# In automated pytest runs, default to fast isolated in-memory adapter
# unless specifically opting into PostgreSQL integration testing with USE_POSTGRES_TEST=1
is_testing = "pytest" in sys.modules or bool(os.getenv("TESTING")) or bool(os.getenv("PYTEST_CURRENT_TEST"))
if is_testing and not os.getenv("USE_POSTGRES_TEST"):
    DATABASE_URL = None

if DATABASE_URL and (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")):
    from apps.api.app.adapters.postgres_adapter import PostgresDatabaseAdapter
    db: DatabaseAdapter = PostgresDatabaseAdapter(database_url=DATABASE_URL)
else:
    db: DatabaseAdapter = InMemoryDatabaseAdapter()
