import sys, json, os, asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.workers.scanner import scan_source
from client import create_shared_client

async def main(url: str):
    async with create_shared_client() as client:
        result = await scan_source(client, url)
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL required"}))
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
