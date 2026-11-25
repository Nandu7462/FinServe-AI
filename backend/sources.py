import asyncio
from io import BytesIO
import os
import re
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
import httpx
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from .providers import fetch_source


OFFICIAL_HOSTS = {"hdfc.bank.in", "www.hdfc.bank.in", "hdfcbank.com", "www.hdfcbank.com"}


def check_url(url):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname not in OFFICIAL_HOSTS or parsed.username is not None
            or parsed.password is not None or parsed.port not in (None, 443)
            or parsed.fragment or "\\" in url or any(c.isspace() for c in url)):
        raise ValueError("Use the final public HTTPS address on HDFC Bank’s official website.")
    return parsed.hostname


def parse_document(data, mime):
    if mime == "application/pdf":
        try:
            return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(data)).pages)
        except PyPdfError as error:
            raise ValueError("Could not read the source PDF.") from error
    if mime not in {"text/html", "application/xhtml+xml"}:
        raise ValueError("Choose an HTML page or text-based PDF.")
    page = BeautifulSoup(data, "html.parser")
    for element in page.select("script, style, noscript, template, nav, footer, header"):
        element.decompose()
    article = page.find("main") or page.body or page
    return article.get_text(" ", strip=True)


async def retrieve(url):
    check_url(url)
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    retriever_setting = os.getenv("SOURCE_RETRIEVER")
    
    if retriever_setting == "firecrawl" or (firecrawl_key and retriever_setting != "direct"):
        try:
            markdown = await fetch_source(url)
            return markdown, "Firecrawl"
        except Exception as error:
            if retriever_setting == "firecrawl":
                raise ValueError(f"Firecrawl scrape failed: {error}") from error
            # Fall back to direct retrieval if Firecrawl encounters transient issue
            pass

    async with httpx.AsyncClient(timeout=30) as client:
        async with client.stream("GET", url, follow_redirects=False) as response:
            response.raise_for_status()
            data = bytearray()
            async for chunk in response.aiter_bytes():
                if len(data) + len(chunk) > 10_000_000:
                    raise ValueError("The source exceeds the 10 MB document limit.")
                data.extend(chunk)
            mime = response.headers.get("content-type", "").split(";")[0].lower()
    text = await asyncio.to_thread(parse_document, bytes(data), mime)
    if not text.strip():
        raise ValueError("The source contains no readable text.")
    return text, "Official website"


def normalized(text):
    return " ".join(text.split()).casefold()


def extract_notice_candidate(url: str, text: str, retriever: str):
    parsed = urlsplit(url)
    check_url(url)
    bank = "HDFC Bank"

    # Determine category and key statement
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+(?!\d)", text) if len(s.strip()) > 20]
    
    category = "Product"
    statement = ""
    title = f"{bank} Customer Notice"
    product = "Financial Service"

    fee_keywords = ["are free", "annual fee", "fee", "charge", "penalty", "cost", "commission", "interest rate", "tariff"]
    service_keywords = ["maintenance", "downtime", "unavailable", "schedule", "upgrade", "outage", "system update"]
    product_keywords = ["account", "card", "deposit", "savings", "investment", "bonds", "loan"]

    # Check for fee passage
    for s in sentences:
        s_lower = s.lower()
        if any(k in s_lower for k in fee_keywords) and any(c in s for c in ["₹", "$", "£", "€", "%", "free", "no fee", "zero"]):
            category = "Fee"
            statement = s[:400]
            title = f"{bank} Fee Information"
            break

    # If no fee passage, check for service maintenance
    if not statement:
        for s in sentences:
            s_lower = s.lower()
            if any(k in s_lower for k in service_keywords):
                category = "Service"
                statement = s[:400]
                title = f"{bank} Service Information"
                break

    # If still none, check product info
    if not statement:
        for s in sentences:
            s_lower = s.lower()
            if any(k in s_lower for k in product_keywords):
                category = "Product"
                statement = s[:400]
                title = f"{bank} Product Information"
                break

    if not statement and sentences:
        statement = sentences[0][:400]

    # Guess product name from URL or title
    path_segments = [p for p in parsed.path.split("/") if p and len(p) > 2]
    if path_segments:
        product_slug = path_segments[-1].replace("-", " ").replace("_", " ").title()
        product = product_slug
    
    return {
        "url": url,
        "bank": bank,
        "title": title,
        "product": product,
        "category": category,
        "statement": statement,
        "retriever": retriever,
        "text_preview": text[:1000] + ("..." if len(text) > 1000 else ""),
    }
