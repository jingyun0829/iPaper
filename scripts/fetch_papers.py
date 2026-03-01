import feedparser
import hashlib
import os
import re
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

FEEDS = [
    {"journal": "Management Science", "category": "OM/IS", "url": "https://pubsonline.informs.org/action/showFeed?type=etoc&feed=rss&jc=mnsc"},
    {"journal": "Information Systems Research", "category": "OM/IS", "url": "https://pubsonline.informs.org/action/showFeed?type=etoc&feed=rss&jc=isre"},
    {"journal": "Marketing Science", "category": "Marketing", "url": "https://pubsonline.informs.org/action/showFeed?type=etoc&feed=rss&jc=mksc"},
    {"journal": "arXiv (cs.IR)", "category": "CS/AI", "url": "https://rss.arxiv.org/rss/cs.IR"},
    {"journal": "arXiv (econ.GN)", "category": "Economics", "url": "https://rss.arxiv.org/rss/econ.GN"},
]

def clean_html(text):
    if not text: return ""
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()

def paper_id(title, doi=""):
    key = (doi or title).lower().strip()
    return hashlib.sha256(key.encode()).hexdigest()[:16]

def extract_doi(entry):
    for field in ["prism_doi", "dc_identifier", "id", "link"]:
        val = getattr(entry, field, "")
        if val and "10." in val:
            match = re.search(r"10\.\d{4,}/\S+", val)
            if match:
                return match.group(0).rstrip(".")
    return ""

def fetch_abstract_crossref(doi):
    if not doi: return ""
    try:
        r = requests.get(
            f"https://api.crossref.org/works/{doi}",
            headers={"User-Agent": "PaperPulse/1.0"},
            timeout=8,
        )
        if r.status_code == 200:
            abstract = r.json().get("message", {}).get("abstract", "")
            if abstract:
                return re.sub(r"<[^>]+>", "", abstract).strip()[:3000]
    except Exception:
        pass
    return ""

def extract_abstract(entry):
    for field in ["summary", "content", "description"]:
        val = getattr(entry, field, None)
        if isinstance(val, list):
            val = val[0].get("value", "") if val else ""
        if val and len(clean_html(val)) > 80:
            return clean_html(val)[:3000]
    return ""

def extract_authors(entry):
    if hasattr(entry, "authors") and entry.authors:
        names = [a.get("name", "") for a in entry.authors[:5]]
        result = ", ".join(n for n in names if n)
        if len(entry.authors) > 5:
            result += " et al."
        return result
    return getattr(entry, "author", "") or ""

def fetch_feed(feed_config):
    papers = []
    try:
        print(f"  Fetching {feed_config['journal']}...")
        feed = feedparser.parse(feed_config["url"])
        if feed.bozo and not feed.entries:
            print(f"    ⚠️  Feed error: {feed.bozo_exception}")
            return papers
        for entry in feed.entries[:15]:
            title = clean_html(getattr(entry, "title", ""))
            if not title or len(title) < 10:
                continue
            doi = extract_doi(entry)
            abstract = extract_abstract(entry)
            if len(abstract) < 80 and doi:
                abstract = fetch_abstract_crossref(doi)
                if abstract:
                    print(f"      📖 Got abstract via CrossRef")
                time.sleep(0.3)
            pub_date = None
            for df in ["published_parsed", "updated_parsed"]:
                parsed = getattr(entry, df, None)
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
                "tags": [],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })
        print(f"    ✅ {len(papers)} papers")
    except Exception as e:
        print(f"    ❌ Error: {e}")
    return papers

def main():
    print(f"\n🚀 PaperPulse Fetcher — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)
    all_papers = []
    for fc in FEEDS:
        all_papers.extend(fetch_feed(fc))
        time.sleep(1)
    print(f"\n📦 Total: {len(all_papers)} papers")
    if all_papers:
        supabase.table("papers").upsert(all_papers, on_conflict="id", ignore_duplicates=False).execute()
        print(f"💾 Saved to Supabase!")
    print("✅ Done!\n")

if __name__ == "__main__":
    main()
