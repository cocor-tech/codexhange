import os
from pymongo import MongoClient

client = None
db = None

def connect():
    global client, db
    if db:
        return db
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI environment variable is required")
    client = MongoClient(uri)
    db = client.get_default_database()
    return db

def close():
    global client
    if client:
        client.close()
        client = None
        global db
        db = None
