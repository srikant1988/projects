"""Best-effort company enrichment for the "Add client" flow: logo + a
*suggested* country, both from free unauthenticated public APIs.

Nothing here is authoritative. Company-name search against Wikipedia is
genuinely ambiguous for short/common names (a name like "Nike" can resolve
to the Greek goddess before the shoe company) -- this is why
ClientLookupResult.country_confidence exists and why the frontend must
present the result as an editable suggestion, never as a filled-in fact.
Any failure (network, no match, unexpected shape) degrades to a null field
rather than raising -- enrichment is optional, client creation must not
depend on any of these third parties being up.
"""
import json
import urllib.request
from urllib.parse import quote

USER_AGENT = "mmm-platform/0.1 (client lookup)"


def _get_json(url: str, timeout: float = 4.0):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _clearbit_domain(query: str) -> tuple[str, str] | None:
    """Returns (name, domain) for the best autocomplete match, if any."""
    try:
        results = _get_json(f"https://autocomplete.clearbit.com/v1/companies/suggest?query={quote(query)}")
    except Exception:
        return None
    if not results:
        return None
    top = results[0]
    domain = top.get("domain")
    if not domain:
        return None
    return top.get("name") or query, domain


def _logo_for_domain(domain: str) -> str:
    # icon.horse is a free, keyless favicon/logo-by-domain service.
    return f"https://icon.horse/icon/{domain}"


def _wikidata_country_label(qid: str) -> str | None:
    try:
        data = _get_json(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")
    except Exception:
        return None
    entity = data.get("entities", {}).get(qid, {})
    claims = entity.get("claims", {})
    country_qid = None
    for prop in ("P17", "P159"):  # country, then headquarters location as fallback
        if prop in claims:
            try:
                country_qid = claims[prop][0]["mainsnak"]["datavalue"]["value"]["id"]
                break
            except (KeyError, IndexError):
                continue
    if not country_qid:
        return None
    try:
        labels = _get_json(
            f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={country_qid}"
            "&props=labels&languages=en&format=json"
        )
        return labels["entities"][country_qid]["labels"]["en"]["value"]
    except Exception:
        return None


def _suggest_country(query: str) -> str | None:
    try:
        search = _get_json(
            f"https://en.wikipedia.org/w/api.php?action=opensearch&search={quote(query)}"
            "&limit=1&namespace=0&format=json"
        )
        titles = search[1] if len(search) > 1 else []
        if not titles:
            return None
        title = titles[0]
        summary = _get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title)}")
        qid = summary.get("wikibase_item")
        if not qid:
            return None
        return _wikidata_country_label(qid)
    except Exception:
        return None


def lookup_company(query: str) -> dict:
    """Synchronous by design -- run via asyncio.to_thread from the route
    handler so the event loop isn't blocked on these outbound calls."""
    match = _clearbit_domain(query)
    name = match[0] if match else query
    domain = match[1] if match else None
    logo_url = _logo_for_domain(domain) if domain else None
    country = _suggest_country(query)
    return {
        "name": name,
        "domain": domain,
        "logo_url": logo_url,
        "country": country,
        "country_confidence": "suggested",
    }
