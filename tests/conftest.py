import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config import settings

TEST_DB = "oee_chat_test"
settings.db_name = TEST_DB  # set before the app connects


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """Each test starts with empty rate-limit counters."""
    from app import ratelimit
    ratelimit.reset()
    yield
    ratelimit.reset()


@pytest.fixture
def sync_db():
    """Plain sync pymongo handle for direct DB checks in tests."""
    client = MongoClient(settings.mongo_uri)
    client.drop_database(TEST_DB)
    yield client[TEST_DB]
    client.drop_database(TEST_DB)
    client.close()


@pytest.fixture
def client(sync_db):
    from app.main import app
    with TestClient(app) as c:  # runs lifespan: connect + init_db
        yield c
