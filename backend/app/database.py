from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

# Always resolve database path absolutely to project root green_route.db
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_FILE = BASE_DIR / "green_route.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"

# The engine is responsible for actually talking to the database
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# A session is used to send queries to the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for Data Models
Base = declarative_base()