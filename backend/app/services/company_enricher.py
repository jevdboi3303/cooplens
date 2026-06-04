import os
import re
import httpx

CLEARBIT_API_KEY = os.getenv("CLEARBIT_API_KEY", "")

# Funding stage → prestige weight (0–1)
_STAGE_WEIGHT = {
    "public": 1.0,
    "series_e_plus": 0.95,
    "series_d": 0.88,
    "series_c": 0.80,
    "series_b": 0.68,
    "series_a": 0.55,
    "seed": 0.35,
    "angel": 0.28,
    "": 0.40,  # unknown
}

# Employee band midpoints for size scoring
_SIZE_SCORES = {
    "1-10": 20,
    "11-50": 35,
    "51-200": 55,
    "201-500": 68,
    "501-1000": 78,
    "1001-5000": 88,
    "5001-10000": 93,
    "10001+": 97,
}


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _size_score(band: str | None) -> float:
    if not band:
        return 50.0
    return float(_SIZE_SCORES.get(band, 50))


def _stage_score(stage: str | None) -> float:
    if not stage:
        return _STAGE_WEIGHT[""] * 100
    key = stage.lower().replace(" ", "_")
    return _STAGE_WEIGHT.get(key, _STAGE_WEIGHT[""]) * 100


async def enrich_company(company_name: str) -> dict:
    """
    Returns:
        domain, size_band, funding_stage, size_score (0–100),
        stage_score (0–100), company_score (0–100)
    """
    if not CLEARBIT_API_KEY or not company_name.strip():
        return _fallback(company_name)

    # Clearbit Autocomplete → resolve domain from name
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            ac = await client.get(
                "https://autocomplete.clearbit.com/v1/companies/suggest",
                params={"query": company_name},
            )
            ac.raise_for_status()
            suggestions = ac.json()
            if not suggestions:
                return _fallback(company_name)
            domain = suggestions[0].get("domain", "")

            # Company enrichment
            enrich = await client.get(
                f"https://company.clearbit.com/v2/companies/find",
                params={"domain": domain},
                headers={"Authorization": f"Bearer {CLEARBIT_API_KEY}"},
            )
            if enrich.status_code == 404:
                return _fallback(company_name)
            enrich.raise_for_status()
            data = enrich.json()

        size_band = (data.get("metrics") or {}).get("employeesRange") or ""
        funding_stage = (data.get("metrics") or {}).get("raised") or None
        # Clearbit doesn't expose stage by name; use raised $ as proxy
        stage_key = _raised_to_stage(funding_stage)

        s_size = _size_score(size_band)
        s_stage = _stage_score(stage_key)
        company_score = round(0.6 * s_size + 0.4 * s_stage, 1)

        return {
            "domain": domain,
            "size_band": size_band,
            "funding_stage": stage_key,
            "size_score": round(s_size, 1),
            "stage_score": round(s_stage, 1),
            "company_score": min(100.0, company_score),
        }

    except (httpx.HTTPError, Exception):
        return _fallback(company_name)


def _raised_to_stage(raised: float | None) -> str:
    if not raised:
        return ""
    if raised >= 100_000_000:
        return "series_c"
    if raised >= 20_000_000:
        return "series_b"
    if raised >= 5_000_000:
        return "series_a"
    if raised >= 500_000:
        return "seed"
    return "angel"


def _fallback(company_name: str) -> dict:
    return {
        "domain": "",
        "size_band": "",
        "funding_stage": "",
        "size_score": 50.0,
        "stage_score": 40.0,
        "company_score": 46.0,
    }
