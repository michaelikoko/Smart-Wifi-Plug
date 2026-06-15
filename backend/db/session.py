import os
from typing import Annotated
from sqlmodel import SQLModel, create_engine, Session
from fastapi import Depends
from dotenv import load_dotenv
import models

load_dotenv()
SQLITE_URL = os.getenv("SQLITE_URL") or "sqlite:///./database.db"
#POSTGRES_URL = os.getenv("POSTGRES_URL")

connect_args = {"check_same_thread": False}
engine = create_engine(SQLITE_URL, connect_args=connect_args)
#engine = create_engine(POSTGRES_URL, echo=True)

def create_db_and_tables():
    """
    Docstring for create_db_and_tables
    """
    SQLModel.metadata.create_all(engine)

def get_session():
    """
    Docstring for get_session
    """
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]