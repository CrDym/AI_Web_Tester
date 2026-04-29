import os
import json
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "tests", "tester.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def _table_columns(table: str) -> set:
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
    return {r[1] for r in rows}

def _ensure_columns(table: str, columns: dict) -> None:
    existing = _table_columns(table)
    missing = [(name, ddl) for name, ddl in columns.items() if name not in existing]
    if not missing:
        return
    with engine.connect() as conn:
        for name, ddl in missing:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
        conn.commit()

def migrate_schema() -> None:
    try:
        _ensure_columns("cases", {
            "description": "VARCHAR",
            "dataset": "TEXT",
        })
        _ensure_columns("suites", {
            "description": "VARCHAR",
            "env_id": "VARCHAR",
            "setup_case_id": "VARCHAR",
        })
        _ensure_columns("runs", {
            "type": "VARCHAR",
            "token_usage": "TEXT",
            "logs": "TEXT",
            "screenshots": "TEXT",
            "failure_reason": "TEXT",
            "schema_version": "INTEGER",
        })
        _ensure_columns("suite_runs", {
            "case_runs": "TEXT",
        })
    except Exception:
        return

class CaseModel(Base):
    __tablename__ = "cases"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    type = Column(String)
    start_url = Column(String)
    steps = Column(Text) # JSON list
    tags = Column(Text) # JSON list
    dataset = Column(Text) # JSON list
    created_at = Column(Integer)
    updated_at = Column(Integer)

class SuiteModel(Base):
    __tablename__ = "suites"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    env_id = Column(String)
    setup_case_id = Column(String)
    case_ids = Column(Text) # JSON list
    created_at = Column(Integer)
    updated_at = Column(Integer)

class RunModel(Base):
    __tablename__ = "runs"
    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, index=True)
    type = Column(String)
    status = Column(String)
    started_at = Column(Integer)
    ended_at = Column(Integer)
    duration_ms = Column(Integer)
    token_usage = Column(Text) # JSON dict
    failure_reason = Column(Text) # JSON dict
    schema_version = Column(Integer)
    logs = Column(Text) # JSON list
    screenshots = Column(Text) # JSON list

class SuiteRunModel(Base):
    __tablename__ = "suite_runs"
    id = Column(String, primary_key=True, index=True)
    suite_id = Column(String, index=True)
    status = Column(String)
    started_at = Column(Integer)
    ended_at = Column(Integer)
    duration_ms = Column(Integer)
    case_runs = Column(Text) # JSON dict

Base.metadata.create_all(bind=engine)
migrate_schema()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
