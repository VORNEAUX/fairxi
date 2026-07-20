"""Shared pytest fixtures for router unit tests.

A session-wide TestClient avoids repeatedly invoking startup/shutdown
handlers (Motor closes its own event loop on shutdown, which breaks the
next module's client). One client, one app lifecycle, N test modules.
"""
import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
