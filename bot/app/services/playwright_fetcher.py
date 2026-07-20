"""
Playwright-based fetcher to bypass Cloudflare and other bot protections.
Uses a real headless Chromium browser.
"""

import re

BROWSER = None
CF_CHALLENGE = re.compile(r'Just a moment|checking your browser|cf-ray|cloudflare', re.I)

async def get_browser():
    global BROWSER
    if BROWSER is None:
        from playwright.async_api import async_playwright
        p = await async_playwright().start()
        BROWSER = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox", "--disable-setuid-sandbox",
                "--disable-dev-shm-usage", "--disable-gpu",
                "--disable-blink-features=AutomationControlled",
            ],
        )
    return BROWSER

async def fetch_with_playwright(url: str, timeout: float = 25.0) -> dict:
    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
            },
        )
        page = await context.new_page()

        try:
            from playwright_stealth import stealth_async
            await stealth_async(page)
        except:
            pass

        await page.goto(url, wait_until="domcontentloaded", timeout=int(timeout * 1000))

        # Wait for Cloudflare challenge to resolve (up to 15s)
        for _ in range(15):
            title = await page.title()
            if not CF_CHALLENGE.search(title):
                break
            await page.wait_for_timeout(1000)

        content = await page.content()
        final_url = page.url

        # If still blocked, try the homepage URL directly
        if CF_CHALLENGE.search(await page.title()):
            content = ""
            blocked = True
        else:
            blocked = False

        await context.close()
        return {"url": final_url, "status": 200, "text": content, "blocked": blocked, "source": "playwright"}
    except Exception as e:
        return {"url": url, "status": 0, "text": "", "blocked": False, "source": "playwright", "error": str(e)[:200]}
