import re
from bs4 import BeautifulSoup
from typing import Optional, List, Tuple

SKIP_CODES = {
    'THIS','THAT','FROM','WITH','HAVE','THAN','SHOP','HOME','PAGE','MENU',
    'CART','HELP','FREE','SALE','CODE','HTTP','HTTPS','WWW','HTML','CSS',
    'JSON','BLOG','TEXT','FILE','SIZE','TYPE','DATA','LINK','META','HEAD',
    'BODY','DIV','SPAN','FORM','MAIN','NAV','FOOT','COOKIE','CLICK','LOGIN',
    'SIGNUP','ABOUT','PRIVACY','TERMS','RETURN','ORDER','PRICE','VIEW',
    'EDIT','SAVE','LOAD','SEND','MAIL','USER','ADMIN','GUEST','TEMP',
    'TEST','DEMO','NONE','NULL','TRUE','FALSE','ENABLED','DISABLED',
    'NEXT','PREV','BACK','INFO','ERROR','ALERT','TITLE','LABEL','VALUE',
    'STYLE','CLASS','ID','NAME','INDEX','DEFAULT','SITE','SITES','PAGES',
    'WEBSITE','ONLINE','SHOPPING','CHECKOUT','SIGNIN','SIGNOUT','ACCOUNT',
    'WHEN','THEN','LEADING','FOLLOW','AFTER','BEFORE','ABOVE','BELOW',
    'FIRST','LAST','MAIN','MENU','NAV','TAB','TABS',
}

# Common English words that slip past the code regex on coupon pages
# (nav labels, marketing copy, statuses). Real promo codes are rarely
# plain dictionary words, so these are rejected as false positives.
COMMON_WORDS = {
    'ACCOUNT','ACTIVE','ADDRESS','ADVANCE','AGREE','ALERT','ALREADY','ALWAYS',
    'AMAZON','AMOUNT','APPLE','APPLY','AREA','ARRIVAL','ARTICLES','ASIAN',
    'AUTHOR','AVAILABLE','AWARD','BABIES','BABY','BAG','BAGS','BEAUTY',
    'BEHIND','BENEFIT','BEST','BETTER','BIRTHDAY','BLACK','BONUS','BRAND',
    'BREAD','BREAK','BRIDGE','BRIEF','BRIGHT','BRING','BROWSER','BUILDING',
    'BUNDLE','BUTTON','CALL','CAMPAIGN','CANCEL','CARD','CAREER','CARTON',
    'CASUAL','CATEGORY','CENTER','CERTAIN','CHANGE','CHANNEL','CHARGE',
    'CHARITY','CHARLES','CHECK','CHECKOUT','CHICKEN','CHOICE','CHOOSE',
    'CITY','CLEAN','CLIENT','CLOSE','CLOTHING','CLOUD','COLLECT','COLLEGE',
    'COLOR','COMMENT','COMMON','COMPANY','COMPLETE','CONTACT','CONTENT',
    'CONTINUE','COOKIES','CORNER','COSTUME','COUNT','COUPLE','COURSE',
    'COVER','CREATE','CREDIT','CURRENT','CUSTOMER','DAMAGE','DANCE',
    'DEALER','DEALS','DEBATE','DECIDE','DEGREE','DELIVERY','DENTAL',
    'DESIGN','DESIRE','DETAIL','DEVICE','DIFFERENT','DIGITAL','DIRECT',
    'DIRECTORY','DISCOVER','DISCUSSION','DISTRICT','DOCTOR','DOUBLE',
    'DOWNLOAD','DRIVER','DURING','EAGER','EARN','EARTH','EDITION','EDITOR',
    'EDUCATION','EFFECT','ELECTRIC','ELECTRONIC','ELEVATOR','EMAIL','EMERGE',
    'EMPIRE','EMPLOYEE','EMPTY','ENABLE','ENERGY','ENGINE','ENJOY','ENOUGH',
    'ENTIRE','ENTRY','ENVIRONMENT','EQUAL','EQUIPMENT','ERROR','EVENT',
    'EVENTUALLY','EVERY','EVIDENCE','EXACTLY','EXCHANGE','EXIST','EXPAND',
    'EXPECT','EXPIRE','EXPIRED','EXPIRY','EXPLAIN','EXPLORE','EXPORT',
    'EXPRESS','EXTRA','FACILITY','FACTORY','FAILURE','FAMILY','FASHION',
    'FAVORITE','FEATURE','FEBRUARY','FEEDBACK','FEMALE','FESTIVAL','FIFTH',
    'FIGURE','FILTER','FINAL','FINANCE','FINISH','FIRST','FLASH','FLEET',
    'FLOOR','FOCUS','FOLLOW','FONT','FOOTER','FORGOT','FORMAT','FORMULA',
    'FORWARD','FOUND','FRAME','FRIDAY','FRIEND','FRIENDS','FRONT','FRUIT',
    'FULLY','FUNDS','FUTURE','GALLERY','GAMING','GARDEN','GENERAL','GIFT',
    'GLANCE','GLASS','GLOBAL','GOOGLE','GRADUATE','GRAND','GRANTS','GROCERY',
    'GROUND','GROUP','GUEST','GUIDE','HALF','HANDLE','HAPPEN','HAPPY',
    'HARVEST','HEALTH','HEALTHY','HEARING','HEAVY','HELPFUL','HIDDEN',
    'HIGHLIGHT','HISTORY','HOLDER','HOLIDAY','HOMEPAGE','HONEST','HOSPITAL',
    'HOTEL','HOURS','HOUSE','HUMAN','HUNDRED','ICON','IDEAS','IMAGE','IMPORT',
    'IMPORTANT','INCLUDE','INCOME','INCREASE','INDIAN','INDOOR','INDUSTRY',
    'INFANT','INFORMATION','INSIDE','INSTALL','INSTANT','INSTRUCTOR','INTEND',
    'INTEREST','INTERESTING','INTERIOR','INTERNATIONAL','INTERNET','INTERVIEW',
    'INVEST','INVOICE','ISSUE','ITEMS','JANUARY','JOURNEY','JULY','JUNE',
    'JUSTIFY','KEEPING','KINDLE','KINGDOM','KNOWLEDGE','LANGUAGE','LARGE',
    'LAST','LATEST','LAUNCH','LEADER','LEARNING','LEASE','LEAST','LEATHER',
    'LEGAL','LENGTH','LESSON','LEVEL','LIBRARY','LIFESTYLE','LIGHT','LIMIT',
    'LINKED','LISTEN','LITTLE','LIVING','LOCAL','LOCATED','LOCATION','LOGIN',
    'LOWER','LUCKY','LUNCH','MAGAZINE','MAJORITY','MAKEUP','MALE','MANAGE',
    'MANAGEMENT','MARCH','MARKET','MARKETING','MARRIED','MASSIVE','MASTER',
    'MATCH','MATERIAL','MATTER','MAYBE','MEANING','MEDICAL','MEDICINE','MEDIUM',
    'MEETING','MEMBER','MEMBERS','MEMORY','MENTAL','MENTION','MERCHANT',
    'MERCHANDISE','MESSAGE','METHOD','METRO','MIDDLE','MIGHT','MILE','MILITARY',
    'MILLION','MINORITY','MINUTE','MISSION','MIXTURE','MOBILE','MODEL','MODERN',
    'MONDAY','MONTHLY','MOODLE','MORNING','MOTION','MOTOR','MOUNTAIN','MOVIE',
    'MULTIPLE','MUSIC','MYSELF','NATION','NATIONAL','NATIVE','NATURE','NEARLY',
    'NECESSARY','NETWORK','NEVER','NEWSLETTER','NICE','NINETY','NOTHING','NOTICE',
    'NOVEMBER','NUMBER','OBJECT','OCCUR','OCTOBER','OFFER','OFFICE','OFFICIAL',
    'OFTEN','OPENING','OPERATE','OPERATOR','OPINION','OPPORTUNITY','OPTION',
    'ORDERED','ORGANIZATION','ORIGINAL','OTHER','OUTDOOR','OUTPUT','OVERALL',
    'OWNER','PACKAGE','PAGE','PAGES','PAID','PAIR','PAPER','PARENT','PARKING',
    'PARTICULAR','PARTNER','PARTY','PASSAGE','PASSION','PAST','PASSWORD','PAYMENT',
    'PEOPLE','PERCENT','PERFECT','PERFORMANCE','PERIOD','PERSON','PERSONAL',
    'PHONE','PHOTO','PHYSICAL','PICTURE','PIECE','PINK','PLACES','PLANET',
    'PLANNING','PLAYER','PLUS','POLICY','POLITICAL','POPULAR','PORTION',
    'POSITION','POSITIVE','POSSIBLE','POSTER','POTENTIAL','POUND','POWER',
    'PRACTICAL','PRACTICE','PREFER','PRESENT','PRESS','PRESSURE','PREVIEW',
    'PRIMARY','PRINT','PRINTER','PRIORITY','PRIVATE','PROBABLY','PROBLEM',
    'PROCESS','PRODUCE','PRODUCT','PRODUCTS','PROFESSIONAL','PROFIT','PROGRAM',
    'PROGRAMME','PROGRESS','PROJECT','PROMISE','PROMO','PROMOTION','PROPERLY',
    'PROPERTY','PROTECT','PROVIDE','PUBLIC','PURCHASE','PURPOSE','PUSHING',
    'QUALITY','QUARTER','QUESTIONS','QUICKLY','QUIET','QUOTE','RADIO','RAISE',
    'RANGE','RAPIDLY','REACH','REACTION','READER','READING','READY','REALITY',
    'REALLY','REASON','REASONABLE','RECALL','RECEIVE','RECENT','RECENTLY',
    'RECORD','REDUCE','REFER','REFERENCE','REFLECT','REGARD','REGION','RELATED',
    'RELATIONSHIP','RELEASE','RELEVANT','REMAIN','REMEMBER','REMOVE','REPEAT',
    'REPLACE','REPORT','REPRESENT','REQUIRE','RESEARCH','RESOURCE','RESPECT',
    'RESPOND','RESPONSE','RESULT','RETURN','REVEAL','REVIEW','RIGHT','RING',
    'ROAD','ROLE','ROOM','ROUND','ROUTINE','ROYAL','RULE','RUNNING','SAFETY',
    'SAINTS','SAMPLE','SATURDAY','SCHOOL','SCIENCE','SCORE','SCREEN','SEARCH',
    'SEASON','SECOND','SECTION','SECURITY','SELECT','SELECTION','SELLER',
    'SEMINAR','SENIOR','SENSE','SEPARATE','SERIES','SERVICE','SERVICES',
    'SESSION','SETTING','SETTINGS','SEVERAL','SHARE','SHARING','SHEET','SHIPPING',
    'SHIRT','SHOES','SHOPPING','SHORTS','SHOULD','SHOWING','SIGNED','SIGNUP',
    'SILVER','SIMILAR','SIMPLE','SIMPLY','SINGLE','SISTER','SITUATION','SIXTY',
    'SIZE','SKILL','SLIGHTLY','SMALL','SMART','SOCIAL','SOCIETY','SOFTWARE',
    'SOLUTION','SOMETHING','SONG','SORT','SOURCES','SPACE','SPEAK','SPECIAL',
    'SPECIES','SPECIFIC','SPEECH','SPEED','SPEND','SPIRIT','SPONSOR','SPORT',
    'SPORTS','SQUARE','STAFF','STANDARD','STARTING','STATE','STATEMENT','STATUS',
    'STAYING','STEP','STILL','STOCK','STOP','STORAGE','STORES','STORE','STORY',
    'STREET','STRENGTH','STRESS','STRONG','STUDENT','STUDENTS','STUDIO','STUDY',
    'SUBJECT','SUBSCRIBE','SUCCESS','SUCCESSFUL','SUMMER','SUNDAY','SUPPORT',
    'SUPPOSE','SURE','SURFACE','SYSTEM','TABLE','TAKING','TALENT','TALKING',
    'TARGET','TEACHER','TEAM','TECHNOLOGY','TELEPHONE','TELEVISION','TENSION',
    'TERMS','TESTIMONY','THANK','THANKS','THEATER','THEIR','THEME','THERE',
    'THEY','THIRD','THING','THINKING','THOUSAND','THROAT','THURSDAY','TICKET',
    'TITLE','TODAY','TOGETHER','TOMORROW','TONIGHT','TOTAL','TOUCH','TOWARD',
    'TRACK','TRADE','TRAINING','TRANSFER','TRAVEL','TREATMENT','TREND','TRIP',
    'TRUTH','TUESDAY','TURNING','TWELVE','TWENTY','TWICE','TYPICAL','UNABLE',
    'UNDER','UNDERSTAND','UNITED','UNIVERSITY','UNLESS','UNUSUAL','UPDATED',
    'UPLOAD','UPSTAIRS','USEFUL','USER','USERS','USUALLY','VALENTINE','VALUE',
    'VARIETY','VARIOUS','VEHICLE','VENTURE','VERSION','VETERAN','VICTORY',
    'VIDEO','VILLAGE','VIRTUAL','VISIBLE','VISION','VISITOR','VISUAL','VITAL',
    'VOICE','VOLUME','VOTING','WALKING','WALLET','WANTED','WARNING','WATCH',
    'WATER','WEDNESDAY','WEEKEND','WEEKLY','WEIGHT','WELCOME','WESTERN','WHERE',
    'WHETHER','WHICH','WHILE','WHOLE','WINDOW','WINTER','WITHIN','WITHOUT',
    'WOMAN','WONDER','WOODEN','WORKING','WORLD','WOULD','WRAPPER','WRITING',
    'WRITTEN','WRONG','YARD','YEARLY','YELLOW','YESTERDAY','YORKSHIRE','YOUNG',
    'YOUR','YOURSELF','ZERO','ZONE','INTO','MANY','PAYPAL','REVEALED',
    'DISCOUNT','VOUCHER','CODES','CODESAVE','DESCUENTOS','SMANAGE',
    'SSELECTION','SSAVE','SAVINGS','GOLF','SAVING','TRAVEL','TICKETS',
    'DINING','TRAINING','SHOTUKDEALS','GOLFCREW','EXPEDIATAKE','BUYING',
    'SHOPPING','BOOKING','FLYING','OFFERS','COUPONS','DEALS','PROMOS',
}

def validate_code(raw: Optional[str]) -> Optional[str]:
    if not raw: return None
    cleaned = raw.strip().upper()
    if len(cleaned) < 4 or len(cleaned) > 25: return None
    if " " in cleaned: return None
    if not re.match(r'^[A-Z0-9_\-+]+$', cleaned): return None
    if cleaned in SKIP_CODES or cleaned in COMMON_WORDS: return None
    if re.match(r'^\d+$', cleaned): return None
    # text fragments sliced out of longer words ("PROMOTIONS" -> "TIONS")
    if cleaned.endswith(("TION", "TIONS", "MENT", "MENTS", "MENTAL")): return None
    # class-name slicing artifacts like "SSAVE", "SSELECTION"
    if cleaned.startswith("SS") and len(cleaned) <= 10: return None
    return cleaned

def infer_code_from_url(url: str, brand_name: str = "") -> Optional[str]:
    path = url.split("?")[0].lower()
    m = re.search(r'/(?:promo|coupon|code|offer|deal|save|voucher|referral)/([a-z0-9_\-+]{4,25})(?:/|$|\.)', path)
    if m: return validate_code(m.group(1))
    m = re.search(r'[?&](?:code|coupon|promo|offer|ref|referral)=([a-z0-9_\-+]{4,25})(?:&|$)', url.lower())
    if m: return validate_code(m.group(1))
    if brand_name:
        slug = brand_name.lower().replace(" ", "").replace("-", "")[:10]
        for p in [rf'(?:try|save|use|get){slug}', rf'{slug}(?:20|save|deal|off|code)']:
            m = re.search(p, path)
            if m: return validate_code(m.group(0))
    return None

def extract_codes_from_soup(soup: BeautifulSoup, url: str = "", brand_name: str = "") -> List[str]:
    codes = set()
    html = str(soup) if soup else ""
    text = soup.get_text() if soup and hasattr(soup, "get_text") else ""
    if not html or len(html) < 100: return []

    # Pattern 1: Explicit labels
    for p in [
        re.compile(r'(?:code|coupon|promo|voucher|discount\s+code)[:\s]*["\'\(]*([A-Z0-9_\-]{4,25})["\'\)]*', re.I),
        re.compile(r'(?:use|enter|apply|try)\s+(?:code\s+|promo\s+|coupon\s+)?["\']?([A-Z0-9_\-]{4,25})["\']?', re.I),
    ]:
        for m in p.finditer(text):
            c = validate_code(m.group(1))
            if c: codes.add(c)

    # Pattern 2: Page title
    title_tag = soup.find("title")
    if title_tag:
        title_text = title_tag.get_text(strip=True)
        m = re.search(r'(?:offer|deal|code|coupon|promo|save)\s+(?:to\s+)?(?:viewers\s+)?([A-Za-z0-9_\-+]{4,25})(?:\s|$)', title_text, re.I)
        if m:
            c = validate_code(m.group(1))
            if c: codes.add(c)

    # Pattern 3: <code>, <kbd>, <samp> tags
    for tag in soup.find_all(["code", "kbd", "samp"]):
        c = validate_code(tag.get_text(strip=True))
        if c: codes.add(c)

    # Pattern 4: <input readonly value="CODE">
    for inp in soup.find_all("input", readonly=True):
        c = validate_code(inp.get("value", ""))
        if c: codes.add(c)

    # Pattern 5: Elements with coupon/promo class
    for cls_name in ["coupon", "coupon-code", "promo-code", "promo", "discount-code", "code-value", "copy-code"]:
        for el in soup.select(f"[class*='{cls_name}']"):
            c = validate_code(el.get_text(strip=True))
            if c: codes.add(c)
            for attr in ["data-code", "data-coupon", "data-promo", "data-clipboard-text"]:
                c2 = validate_code(el.get(attr, ""))
                if c2: codes.add(c2)

    # Pattern 6: Near "Copy" buttons — only when the surrounding container has
    # code-ish context, and never grab the button's own words.
    for btn in soup.find_all(["button", "a", "span"]):
        btn_text = btn.get_text(strip=True).lower()
        if "copyright" in btn_text:
            continue
        if not any(kw in btn_text for kw in ["copy code", "copy coupon", "copy"]):
            continue
        container = btn.parent
        candidates = [container]
        if container and len(container.get_text(" ", strip=True)) < 60 and container.parent:
            candidates.append(container.parent)
        for parent in candidates:
            if not parent:
                continue
            txt = parent.get_text(" ", strip=True)
            if 200 < len(txt) or len(txt) < 8:
                continue
            if not re.search(r'(code|coupon|promo|voucher|%|off|save|deal)', txt, re.I):
                continue
            btn_tokens = set(btn.get_text(strip=True).upper().split())
            for m in re.finditer(r'\b([A-Z0-9_\-]{4,20})\b', txt.upper()):
                c = validate_code(m.group(1))
                if c and m.group(1) not in btn_tokens:
                    codes.add(c)

    # Pattern 7: JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string)
            items = data.get("@graph", [data]) if isinstance(data, dict) else data
            for item in items:
                if isinstance(item, dict):
                    for key in ["code", "couponCode", "discountCode", "promoCode"]:
                        c = validate_code(str(item.get(key, "")))
                        if c: codes.add(c)
        except: pass

    # Pattern 8: Meta tags
    for meta in soup.find_all("meta"):
        name = (meta.get("name") or meta.get("property") or "").lower()
        content = meta.get("content", "")
        if any(kw in name for kw in ["coupon", "promo", "discount", "code"]):
            c = validate_code(content)
            if c: codes.add(c)

    # Pattern 9: Data attributes
    for attr in ["data-code", "data-coupon", "data-promo", "data-discount", "data-clipboard"]:
        for el in soup.find_all(attrs={attr: True}):
            c = validate_code(el[attr])
            if c: codes.add(c)

    # Pattern 10: URL inference
    if url:
        url_code = infer_code_from_url(url, brand_name)
        if url_code: codes.add(url_code)

    # Never accept the brand's own name as a code (nav labels, logos)
    if brand_name:
        brand_tokens = {t.upper() for t in re.findall(r"[A-Za-z0-9]{3,}", brand_name)}
        codes = {c for c in codes if c not in brand_tokens}

    return list(codes)

def extract_codes_from_text(text: str, url: str = "", brand_name: str = "") -> List[str]:
    codes = set()
    text_upper = text.upper() if text else ""
    if not text or len(text) < 100: return []

    for p in [
        re.compile(r'(?:code|coupon|promo|voucher)[:\s]+["\'\(]*([A-Z0-9_\-]{4,25})["\'\)]*', re.I),
        re.compile(r'(?:use|enter|apply|try)\s+(?:code\s+)?["\']?([A-Z0-9_\-]{4,25})["\']?', re.I),
    ]:
        for m in p.finditer(text_upper):
            c = validate_code(m.group(1))
            if c: codes.add(c)

    if url:
        url_code = infer_code_from_url(url, brand_name)
        if url_code: codes.add(url_code)

    return list(codes)
