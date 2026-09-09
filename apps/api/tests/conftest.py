import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from crimestack.db import Base, get_db
from crimestack.main import app, login_attempts
from crimestack.models import AuditHead


@pytest.fixture
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        db.add(AuditHead(id=1, sequence=0, digest="0" * 64))
        db.commit()

    def override():
        with factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = override
    login_attempts.clear()
    with TestClient(app) as c:
        c.factory = factory
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def admin(client):
    response = client.post(
        "/api/auth/bootstrap",
        json={
            "email": "admin@example.test",
            "password": "Testing-password-2026",
            "bootstrap_secret": "local-bootstrap-change-me",
        },
    )
    assert response.status_code == 200, response.text
    client.headers["Authorization"] = "Bearer " + response.json()["access_token"]
    return response.json()["user"]


@pytest.fixture
def dataset(client, admin):
    raw = b"id,date,primary_type,lat,lon,district,severity,police_station\n1,2026-01-05,Theft,12.97,77.59,Bengaluru,high,S1\n2,2026-01-12,Theft,12.971,77.591,Bengaluru,low,S1\n3,2026-02-02,Fraud,,,Mysuru,medium,S2\n4,2026-02-02,Theft,12.972,77.592,Bengaluru,critical,S1\n"
    response = client.post(
        "/api/datasets",
        files={"file": ("test.csv", raw)},
        data={
            "name": "Fictional test",
            "publisher": "Test fixture",
            "provenance": "synthetic_demo",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()
