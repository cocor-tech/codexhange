import os
from typing import Optional
from urllib.parse import urlparse, unquote
from pymongo import MongoClient

DEFAULT_DB_NAME = "codexhange"
_client: Optional[MongoClient] = None
_db = None

def _db_name_from_uri(uri: str) -> Optional[str]:
    try:
        path = urlparse(uri.replace("mongodb+srv://", "mongodb://")).path
        if path and path != "/":
            return unquote(path.lstrip("/").split("/")[0])
    except Exception:
        pass
    return None

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
    _db = _client[_db_name_from_uri(uri) or DEFAULT_DB_NAME]
    return _db

def close():
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None
