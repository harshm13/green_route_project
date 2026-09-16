from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# This creates a local SQLite file named green_route.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./green_route.db"

# The engine is responsible for actually talking to the database
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# A session is used to send queries to the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# This Base class is what we will use to create our Data Models later
Base = declarative_base()