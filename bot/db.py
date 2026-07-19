import os
from typing import Optional
from pymongo import MongoClient

_client: Optional[MongoClient] = None
_db = None

def connect():
    global _client, _db
    if _db is not None:
        return _db
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is required")
    _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    _db = _client.get_default_database()
    return _db

def close():
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None
