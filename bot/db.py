import os
from typing import Optional
from pymongo import MongoClient

DEFAULT_DB_NAME = os.environ.get("MONGODB_DB", "codexhange")
_client: Optional[MongoClient] = None
_db = None

def _uri_with_db(uri: str) -> str:
    host_part = uri.split("?")[0].replace("mongodb+srv://", "", 1)
    if "/" in host_part.split("@")[-1]:
        return uri
    sep = "&" if "?" in uri else "?"
    return f"{uri}{sep}authSource={DEFAULT_DB_NAME}"

def connect():
    global _client, _db
    if _db is not None:
        return _db
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is required")
    uri = _uri_with_db(uri)
    _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    _db = _client[DEFAULT_DB_NAME]
    return _db

def close():
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None
