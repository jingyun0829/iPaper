"""
PaperPulse - Daily Paper Fetcher
Fetches latest papers from top journal RSS feeds and saves to Supabase.

Setup:
    pip install feedparser supabase python-dotenv requests

Environment variables needed:
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_KEY=your-service-role-key
"""

import feedparser
import hashlib
import os
import re
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# ─── Supabase client ──────────────────────────────────────────────────────────
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

# ─── Journal RSS feeds ────────────────────────────────────────────────────────
# All free/open RSS feeds — no login required
FEEDS = [
    # OM / IS
    {
        "journal": "Management Science",
        "category": "OM/IS",
        "url": "https://pubsonline.informs.org/action/showFeed?type=etoc&feed=rss&jc=mnsc",
    },
    {
        "journal": "MIS Quarterly",
        "category": "OM/IS",
        "url": "https://misq.umn.edu/skin/frontend/misq/default/feed/rss.xml",
    },
    {
        "journal": "Information Systems Research",
        "category": "OM/IS",
        "url": "https://pubsonline.informs.org/action/showFeed?type=etoc&feed=rss&jc=isre",
    },
    {
        "journal": "Production and Operations Management",
        "category": "OM/IS",
        "url": "https://onlinelibrary.wiley.com/action/showFeed?jc=19375956&type=etoc&feed=rss",
    },
    # Marketing
    {
        "journal": "Marketing Science",
        "category": "Marketing",
        "url": "https://pubsonline.informs.org/action/showFeed?type=etoc&feed=rss&jc=mksc",
    },
    {
        "journal": "Journal of Marketing Research",
        "category": "Marketing",
        "url": "https://journals.sagepub.com/action/showFeed?ui-pref-journal-subscribe-to-alerts=JMR&feed=rss&jc=jmra",
    },
    # Preprint servers (always open, high volume)
    {
        "journal": "SSRN (OM/IS)",
        "category": "OM/IS",
        "url": "https://papers.ssrn.com/sol3/Jeljour_results.cfm?form_name=journalBrowse&journal_id=994&Network=no&SortOrder=ab_approval_date&start=0&count=20&ftype=RSS",
    },
    {
        "journal": "arXiv (cs.IR)",
        "category": "CS/AI",
        "url": "https://rss.arxiv.org/rss/cs.IR",
    },
    {
        "journal": "arXiv (econ.GN)",
        "category": "Economics",
        "url": "https://rss.arxiv.org/rss/econ.GN",
    },
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def clean_html(text: str) -> str:
    """Strip HTML tags and clean whitespace."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def paper_id(title: str, doi: str = "") -> str:
    """Stable unique ID for deduplication."""
    key = (doi or title).lower().strip()
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def extract_doi(entry) -> str:
    """Try to extract DOI from feed entry."""
    # Check common fields
    for field in ["prism_doi", "dc_identifier", "id", "link"]:
        val = getattr(entry, field, "")
        if val and "10." in val:
            match = re.search(r"10\.\d{4,}/\S+", val)
            if match:
                return match.group(0).rstrip(".")
    return ""


def extract_abstract(entry) -> str:
    """Extract abstract text from various feed formats."""
    for field in ["summary", "content", "description"]:
        val = getattr(entry, field, None)
        if isinstance(val, list):
            val = val[0].get("value", "") if val else ""
        if val and len(clean_html(val)) > 50:
            return clean_html(val)[:3000]
    return ""


def extract_authors(entry) -> str:
    """Extract author string."""
    if hasattr(entry, "authors") and entry.authors:
        names = [a.get("name", "") for a in entry.authors[:5]]
        result = ", ".join(n for n in names if n)
        if len(entry.authors) > 5:
            result += " et al."
        return result
    return getattr(entry, "author", "") or ""


def extract_tags(entry, journal: str) -> list[str]:
    """Extract or infer tags from entry."""
    tags = []
    # From feed tags/categories
    if hasattr(entry, "tags"):
        tags = [t.get("term", "") for t in entry.tags[:5]]
        tags = [t for t in tags if t and len(t) < 40]
    # Always add journal as implicit tag
    return tags[:5]


# ─── Main fetch logic ─────────────────────────────────────────────────────────

def fetch_feed(feed_config: dict) -> list[dict]:
    """Fetch one RSS feed and return list of paper dicts."""
    papers = []
    try:
        print(f"  Fetching {feed_config['journal']}...")
        feed = feedparser.parse(feed_config["url"])

        if feed.bozo and not feed.entries:
            print(f"    ⚠️  Feed error: {feed.bozo_exception}")
            return papers

        for entry in feed.entries[:15]:  # max 15 per feed per run
            title = clean_html(getattr(entry, "title", ""))
            abstract = extract_abstract(entry)

            if not title or len(title) < 10:
                continue

            doi = extract_doi(entry)
            pub_date = None
            for date_field in ["published_parsed", "updated_parsed"]:
                parsed = getattr(entry, date_field, None)
                if parsed:
                    pub_date = datetime(*parsed[:6], tzinfo=timezone.utc).date().isoformat()
                    break
            if not pub_date:
                pub_date = datetime.now(timezone.utc).date().isoformat()

            papers.append({
                "id": paper_id(title, doi),
                "title": title,
                "authors": extract_authors(entry),
                "journal": feed_config["journal"],
                "category": feed_config["category"],
                "abstract": abstract,
                "doi": doi,
                "url": getattr(entry, "link", ""),
                "pub_date": pub_date,
                "tags": extract_tags(entry, feed_config["journal"]),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })

        print(f"    ✅ {len(papers)} papers")
    except Exception as e:
        print(f"    ❌ Error: {e}")

    return papers


def save_to_supabase(papers: list[dict]):
    """Upsert papers into Supabase (skip duplicates by id)."""
    if not papers:
        return 0

    # Supabase upsert — onConflict='id' skips existing papers
    result = supabase.table("papers").upsert(
        papers,
        on_conflict="id",
        ignore_duplicates=True,
    ).execute()

    return len(papers)


def main():
    print(f"\n🚀 PaperPulse Fetcher — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)

    all_papers = []
    for feed_config in FEEDS:
        papers = fetch_feed(feed_config)
        all_papers.extend(papers)
        time.sleep(1)  # be polite to servers

    print(f"\n📦 Total fetched: {len(all_papers)} papers")

    saved = save_to_supabase(all_papers)
    print(f"💾 Saved to Supabase: {saved} papers")
    print("✅ Done!\n")


if __name__ == "__main__":
    main()
