"""Clean up low-quality offers and generate proper writeups in the DB."""
from pymongo import MongoClient
from datetime import datetime, timezone
import os, re, json

uri = os.getenv("MONGODB_URI", "")
if not uri:
    uri = open("/root/codexhange/.env").read().split("MONGODB_URI=")[1].split("\n")[0]

client = MongoClient(uri)
db = client.get_database()

FAKE_CODES = {"CODES", "TIONS", "CODE", "DISCOUNT", "PROMO", "SAVE", "DEAL", "OFFER", "FREE", "SALE", "WALMART"}
COMMON_WORDS = re.compile(r'^(CODES|TIONS|CODE|DISCOUNT|PROMO|SAVE|DEAL|OFFER|FREE|SALE|WELCOME|THANK|CLICK|SHOP|BUY|NOW|HOME|PAGE|TIONS|TION)$', re.I)

offers = list(db.offers.find())
removed = 0
kept = 0

for o in offers:
    code = o.get("code", "")
    title = o.get("title", "")
    confidence = o.get("confidence", 0)
    status = o.get("status", "")

    # Remove fake codes
    if code and (code.upper() in FAKE_CODES or COMMON_WORDS.match(code) or len(code) < 4):
        db.offers.delete_one({"_id": o["_id"]})
        removed += 1
        continue

    # Remove 404 pages
    if "404" in title or "page not found" in title.lower():
        db.offers.delete_one({"_id": o["_id"]})
        removed += 1
        continue

    # Remove low confidence without codes
    if not code and confidence < 60:
        db.offers.delete_one({"_id": o["_id"]})
        removed += 1
        continue

    # Auto-publish good ones
    if confidence >= 60 and status == "pending_review":
        db.offers.update_one({"_id": o["_id"]}, {"$set": {"status": "published"}})

    kept += 1

print(f"Removed {removed} low-quality offers")
print(f"Kept {kept} clean offers")

# Show remaining
offers = list(db.offers.find({"status": "published"}).sort("confidence", -1))
print(f"\n=== {len(offers)} Published Offers ===")
for o in offers:
    print(f"\n## {o.get('store_name', '?')}")
    print(f"- Code: {o.get('code', 'None')}")
    print(f"- Title: {o.get('title', '?')[:80]}")
    print(f"- Discount: {o.get('discount', '?')}")
    print(f"- Updated: {o.get('updatedAt', '?')}")
    print(f"- Confidence: {o.get('confidence', '?')}%")
    print(f"- URL: {o.get('sourceUrl', '?')}")
    print(f"- Type: {o.get('deal_type', '?')}")
