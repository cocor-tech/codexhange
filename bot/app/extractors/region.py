import re
from urllib.parse import urlparse

TLD_COUNTRY = {
    "uk": "United Kingdom", "gb": "United Kingdom", "co.uk": "United Kingdom",
    "de": "Germany", "fr": "France", "it": "Italy", "es": "Spain",
    "jp": "Japan", "cn": "China", "com.cn": "China",
    "in": "India", "br": "Brazil", "com.br": "Brazil",
    "ca": "Canada", "com.au": "Australia", "au": "Australia",
    "nl": "Netherlands", "se": "Sweden", "no": "Norway",
    "dk": "Denmark", "fi": "Finland", "pl": "Poland",
    "cz": "Czech Republic", "at": "Austria", "ch": "Switzerland",
    "ie": "Ireland", "za": "South Africa", "ng": "Nigeria",
    "ae": "UAE", "sa": "Saudi Arabia", "tr": "Turkey",
    "ru": "Russia", "kr": "South Korea", "sg": "Singapore",
    "my": "Malaysia", "th": "Thailand", "vn": "Vietnam",
    "ph": "Philippines", "id": "Indonesia", "hk": "Hong Kong",
    "tw": "Taiwan", "ar": "Argentina", "cl": "Chile",
    "co": "Colombia", "mx": "Mexico",
}

def detect_countries_from_url(url: str) -> list:
    countries = []
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
    except:
        return countries

    host_lower = host.lower()
    m = re.search(r'^(?:[a-z]{2}[-_])?([a-z]{2})\.', host_lower)
    if m and m.group(1) in TLD_COUNTRY:
        countries.append(TLD_COUNTRY[m.group(1)])

    parts = host_lower.split(".")
    for i in range(len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in TLD_COUNTRY:
            cc = TLD_COUNTRY[candidate]
            if cc not in countries:
                countries.append(cc)
            break

    path = parsed.path.lower()
    for m in re.finditer(r'/([a-z]{2})[-_]([a-z]{2})(?:/|$)', path):
        region = m.group(2)
        if region in TLD_COUNTRY:
            cc = TLD_COUNTRY[region]
            if cc not in countries:
                countries.append(cc)

    return countries

def detect_countries(url: str, html_text: str = "", brand_name: str = "") -> list:
    return detect_countries_from_url(url)
