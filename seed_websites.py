"""
Add websites to MongoDB for brands most likely to:
1. NOT have Cloudflare (large e-commerce, SaaS, travel)
2. Actually have public promo code pages
"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGODB_URI", "")
if not uri:
    uri = open("/root/codexhange/.env").read().split("MONGODB_URI=")[1].split("\n")[0]

client = MongoClient(uri)
db = client.get_database()

existing_websites = {w["brand"]["slug"] for w in db.websites.find({}, {"brand.slug": 1})}
print(f"Existing websites: {len(existing_websites)}")

# Brands most likely to have promo codes + no Cloudflare
# Grouped by category confidence
PREFERRED_CATEGORIES = [
    "E-commerce - Global Marketplaces",
    "E-commerce - Fashion",
    "E-commerce - Electronics",
    "E-commerce - Home & Furniture",
    "E-commerce - Beauty",
    "E-commerce - Grocery",
    "E-commerce - Pet Supplies",
    "E-commerce - Gifts & Specialty",
    "Food Delivery & Restaurants",
    "Food Delivery - Meal Kits",
    "Food Delivery - Grocery",
    "Food Delivery - Restaurant Chains",
    "Travel - OTAs",
    "Travel - Hotel Chains",
    "Travel - Car Rental",
    "Travel - Vacation Rentals",
    "Developer Tools & Software",
    "AI Tools & AI SaaS",
    "Web Hosting",
]

cats = {c["name"]: c["_id"] for c in db.categories.find()}

added = 0
for cat_name in PREFERRED_CATEGORIES:
    cat_id = cats.get(cat_name)
    if not cat_id:
        continue
    brands = list(db.brands.find({"categories": cat_id}).limit(25))
    for b in brands:
        slug = b["slug"]
        if slug in existing_websites:
            continue
        website_url = b.get("website", "")
        if not website_url:
            website_url = f"https://{slug}.com"

        db.websites.insert_one({
            "url": website_url,
            "domain": website_url.replace("https://", "").replace("http://", "").split("/")[0],
            "brand": {"name": b["name"], "slug": slug, "category": cat_name},
            "status": "active",
            "settings": {
                "scan_frequency": 12,
                "crawl_depth": 2,
                "javascript": False,
                "auto_publish": False,
                "ai_enabled": True,
            },
            "stats": {
                "offers_found": 0,
                "offers_published": 0,
                "blocked_count": 0,
                "success_rate": 0,
                "health_score": 100,
            },
            "createdAt": __import__("datetime").datetime.now(),
            "updatedAt": __import__("datetime").datetime.now(),
        })
        added += 1
        existing_websites.add(slug)

print(f"Added {added} new websites")
print(f"Total websites: {db.websites.count_documents({})}")
