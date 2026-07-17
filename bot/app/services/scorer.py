def score_confidence(has_codes: bool, keyword_count: int, is_official_site: bool = True, has_expiry: bool = False) -> int:
    score = 40
    score += keyword_count * 6
    if has_codes: score += 20
    if is_official_site: score += 10
    if has_expiry: score += 10
    return min(score, 99)

def auto_publish_threshold(confidence: int) -> str:
    if confidence >= 95: return "published"
    if confidence >= 70: return "pending_review"
    return "discovered"
