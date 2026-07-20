"""
Playwright adapter for promocodes.com — clicks "Use Coupon" buttons to reveal real codes.
Uses a real headless Chromium browser to bypass JS-hidden codes.
"""

import re
from urllib.parse import quote

BASE = "https://www.promocodes.com"

class PromoCodesPWAdapter:
    name = "promocodes_pw"

    async def discover(self, brand: dict, client=None):
        brand_name = brand.get("brandName", brand.get("name", ""))
        slug = brand.get("slug", brand_name.lower().replace(" ", "-"))
        url = f"{BASE}/{quote(slug.lower())}"
        result = []

        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                )
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    viewport={"width": 1920, "height": 1080},
                    locale="en-US",
                )
                page = await context.new_page()

                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                except:
                    await browser.close()
                    return []

                # Check for "Use Coupon" buttons and click them
                buttons = await page.query_selector_all("button:has-text(\"Use Coupon\"), button:has-text(\"See promo code\")")
                
                for btn in buttons:
                    try:
                        async with page.expect_navigation(wait_until="domcontentloaded", timeout=5000):
                            await btn.click()
                        await page.wait_for_timeout(500)
                    except:
                        await page.wait_for_timeout(500)
                    
                    # Check if we were redirected to a coupon detail page
                    current_url = page.url
                    
                    # Extract code from the page after click
                    code = await page.evaluate('''
                        () => {
                            // Check data-code attributes
                            const els = document.querySelectorAll('[data-code]');
                            for (const el of els) {
                                const c = el.getAttribute('data-code');
                                if (c && c.trim().length > 2 && c.trim().length < 30) return c.trim();
                            }
                            // Check code elements
                            const codes = document.querySelectorAll('code, .code, .coupon-code');
                            for (const el of codes) {
                                const t = el.textContent.trim();
                                if (t.length > 2 && t.length < 30 && /^[A-Z0-9_\\-]+$/.test(t)) return t;
                            }
                            return null;
                        }
                    ''')
                    
                    # Also check the URL for coupon IDs
                    cid_match = re.search(r'[?&]c=(\d+)', current_url)
                    coupon_id = cid_match.group(1) if cid_match else None
                    
                    # Get page title for description
                    title = await page.title()
                    
                    if code:
                        # We got a real code
                        entry = {
                            "sourceUrl": current_url or url,
                            "sourcePage": url,
                            "title": (title or f"{brand_name} Promo Code")[:200],
                            "description": "",
                            "code": code,
                            "discount": "Special offer",
                            "deal_type": "code",
                            "type": "promo_code",
                            "confidence": 85 if len(code) >= 4 else 70,
                            "countries": [],
                            "store_name": brand_name,
                            "sourceReliability": "Affiliate",
                            "_adapter": self.name,
                            "blocked": False,
                        }
                        result.append(entry)
                    
                    # Go back to main brand page
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=10000)
                    except:
                        pass

                await browser.close()

        except Exception as e:
            pass

        # Fallback: if Playwright failed or found nothing, return empty
        return result
