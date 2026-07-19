import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
CONCURRENCY = int(os.getenv("CONCURRENCY", "15"))
PLAYWRIGHT = os.getenv("PLAYWRIGHT", "false").lower() == "true"

HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "5.0"))
MAX_CONNECTIONS = int(os.getenv("MAX_CONNECTIONS", "100"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))

AI_PROVIDER = os.getenv("AI_PROVIDER", "")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "")
