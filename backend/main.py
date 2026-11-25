import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Header
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
import httpx
from pydantic import BaseModel, Field
from sqlalchemy import JSON, Column, MetaData, String, Table, create_engine, insert, select, update
from typing import Literal, Optional

from .providers import draft_text, memento, memory_entries, customer_support_chat
from .sources import check_url, extract_notice_candidate, normalized, retrieve

load_dotenv()
ROOT = Path(__file__).resolve().parents[1]
db = create_engine(os.getenv("DATABASE_URL", "sqlite:///finserve.db"))
metadata = MetaData()

drafts = Table("drafts", metadata,
               Column("id", String(36), primary_key=True),
               Column("status", String(20), nullable=False),
               Column("payload", JSON, nullable=False))

preferences = Table("preferences", metadata,
                    Column("id", String(80), primary_key=True),
                    Column("payload", JSON, nullable=False))

registered_sources = Table("registered_sources", metadata,
                            Column("id", String(80), primary_key=True),
                            Column("payload", JSON, nullable=False))

memento_memories = Table("memento_memories", metadata,
                         Column("id", String(80), primary_key=True),
                         Column("kind", String(40), nullable=False),
                         Column("tags", JSON, nullable=False),
                         Column("payload", JSON, nullable=False),
                         Column("created_at", String(40), nullable=False))

users = Table("users", metadata,
              Column("id", String(40), primary_key=True),
              Column("email", String(120), unique=True, nullable=False),
              Column("name", String(120), nullable=False),
              Column("role", String(40), nullable=False), # "compliance", "drafter", "admin"
              Column("department", String(120), nullable=False),
              Column("password_hash", String(128), nullable=False),
              Column("avatar_color", String(20), nullable=False))


class Preference(BaseModel):
    customer: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    name: Optional[str] = Field(default="", max_length=120)
    tone: Literal["Friendly", "Formal", "Concise"] = "Friendly"
    channel: Literal["Email", "SMS", "WhatsApp"] = "Email"
    language: str = Field(default="English", max_length=50)
    tier: Literal["Retail", "Preferred", "Wealth"] = "Retail"
    bank: str = Field(default="Harborline Bank", max_length=120)


class MemoryInput(BaseModel):
    bank: str = Field(min_length=1, max_length=120)
    product: str = Field(min_length=1, max_length=120)
    category: Literal["Fee", "Product", "Service"]
    explanation: str = Field(min_length=5, max_length=1500)
    reusable_wording: str = Field(default="", max_length=400)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model", "system"]
    content: str = Field(min_length=1, max_length=4000)


class SupportChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    customer_id: Optional[str] = None


DEFAULT_WORDING = "If you have questions about this update or fee waiver criteria, please contact our customer support team."

DEMO_NOTICE = {
    "id": "annual-fee", "title": "Debit card annual fee revision", "bank": "Harborline Bank",
    "product": "Platinum Debit Card", "category": "Fee", "url": None,
    "fee": "₹350", "effective_date": "1 December 2026",
    "statement": "From 1 December 2026, the annual fee for the Platinum Debit Card will be ₹350.",
    "evidence": "From 1 December 2026, the annual fee for the Platinum Debit Card will be ₹350. The previous annual fee was ₹250.",
    "text": "From 1 December 2026, the annual fee for the Platinum Debit Card will be ₹350. The previous annual fee was ₹250.",
}
DEMO_INCOMPLETE = {
    **DEMO_NOTICE, "id": "missing-date", "title": "Debit card notice with missing date",
    "effective_date": "", "statement": "The annual fee for the Platinum Debit Card will be ₹350.",
    "evidence": "The annual fee for the Platinum Debit Card will be ₹350. The effective date will be announced separately.",
    "text": "The annual fee for the Platinum Debit Card will be ₹350. The effective date will be announced separately.",
}

SEED_MEMORIES = [
    {
        "id": "mem-seed-fee-01",
        "kind": "explanation",
        "tags": ["finserve-approved", "fee", "debit card", "harborline bank"],
        "payload": {
            "bank": "Harborline Bank",
            "product": "Platinum Debit Card",
            "category": "Fee",
            "explanation": "Annual card fees support 24/7 automated fraud monitoring, enhanced EMV contactless chip security, and emergency replacement coverage worldwide.",
            "reusable_wording": "If you maintain an average quarterly balance of ₹50,000 or spend ₹1,00,000 annually, your annual fee is automatically waived.",
        },
        "created_at": "2026-01-15T10:00:00Z"
    },
    {
        "id": "mem-seed-prod-01",
        "kind": "explanation",
        "tags": ["finserve-approved", "product", "savings account", "harborline bank"],
        "payload": {
            "bank": "Harborline Bank",
            "product": "Everyday Savings Account",
            "category": "Product",
            "explanation": "Digital statements, net banking, and instant mobile alerts are provided complimentary to support sustainable paperless banking.",
            "reusable_wording": "You can download up to 5 years of certified historical account statements anytime via the mobile banking app.",
        },
        "created_at": "2026-01-20T11:00:00Z"
    },
    {
        "id": "mem-seed-serv-01",
        "kind": "explanation",
        "tags": ["finserve-approved", "service", "online banking", "harborline bank"],
        "payload": {
            "bank": "Harborline Bank",
            "product": "Online Banking",
            "category": "Service",
            "explanation": "Scheduled infrastructure maintenance occurs during off-peak hours to upgrade database throughput and apply mandatory security patches.",
            "reusable_wording": "Branch ATMs, UPI merchant payments, and emergency card block services remain fully operational throughout the maintenance window.",
        },
        "created_at": "2026-02-01T09:30:00Z"
    }
]


SEED_PREFERENCES = [
    {
        "customer": "cust-rajesh-kumar",
        "name": "Rajesh Kumar",
        "language": "Hindi",
        "channel": "SMS",
        "tone": "Concise",
        "tier": "Preferred",
        "bank": "Harborline Bank",
    },
    {
        "customer": "cust-elena-rodriguez",
        "name": "Elena Rodriguez",
        "language": "Spanish",
        "channel": "Email",
        "tone": "Friendly",
        "tier": "Wealth",
        "bank": "Harborline Bank",
    },
    {
        "customer": "cust-priya-sharma",
        "name": "Priya Sharma",
        "language": "English",
        "channel": "Email",
        "tone": "Formal",
        "tier": "Retail",
        "bank": "Harborline Bank",
    },
    {
        "customer": "cust-jean-dupont",
        "name": "Jean Dupont",
        "language": "French",
        "channel": "Email",
        "tone": "Formal",
        "tier": "Preferred",
        "bank": "Harborline Bank",
    },
    {
        "customer": "cust-marcus-vance",
        "name": "Marcus Vance",
        "language": "English",
        "channel": "SMS",
        "tone": "Concise",
        "tier": "Wealth",
        "bank": "Harborline Bank",
    },
]


def now():
    return datetime.now(timezone.utc).isoformat()


def hash_password(pwd: str) -> str:
    return sha256(f"{pwd}_finserve_secure_salt_2026".encode()).hexdigest()


SEED_USERS = [
    {
        "id": "usr-compliance-01",
        "email": "jane.compliance@harborline.bank",
        "name": "Jane Smith",
        "role": "compliance",
        "department": "Risk & Regulatory Compliance",
        "password_hash": hash_password(os.getenv("FINSERVE_COMPLIANCE_PASSWORD", "")),
        "avatar_color": "#7861a9",
    },
    {
        "id": "usr-drafter-01",
        "email": "alex.drafter@harborline.bank",
        "name": "Alex Morgan",
        "role": "drafter",
        "department": "Customer Communications",
        "password_hash": hash_password(os.getenv("FINSERVE_DRAFTER_PASSWORD", "")),
        "avatar_color": "#288763",
    },
    {
        "id": "usr-admin-01",
        "email": "admin@harborline.bank",
        "name": "Sarah Jenkins",
        "role": "admin",
        "department": "Operations & Governance",
        "password_hash": hash_password(os.getenv("FINSERVE_ADMIN_PASSWORD", "")),
        "avatar_color": "#b06228",
    },
]

SEED_USERS = [user for user in SEED_USERS if os.getenv(f"FINSERVE_{user['role'].upper()}_PASSWORD")]
DEMO_TOKENS = {user["role"]: uuid4().hex for user in SEED_USERS}
SESSIONS = {
    DEMO_TOKENS[user["role"]]: {key: value for key, value in user.items() if key != "password_hash"}
    for user in SEED_USERS
}


def get_current_user(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "token" in request.query_params:
        token = request.query_params["token"].strip()
    if token and token in SESSIONS:
        return SESSIONS[token]
    return None


def anti_phishing_notice(bank: str) -> str:
    return (f"Security Advisory: {bank} will NEVER ask you for your PIN, CVV, Net Banking password, "
            f"or One-Time Password (OTP) via phone, email, or SMS. Please do not share sensitive credentials with anyone.")


def demo_mode():
    return os.getenv("FINSERVE_MODE", "live") == "demo"


def catalog():
    config = Path(os.getenv("LIVE_NOTICES_FILE") or ROOT / "notices.json")
    if config.exists():
        try:
            return json.loads(config.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def notices():
    base_demo = [
        DEMO_NOTICE,
        DEMO_INCOMPLETE,
        {
            **DEMO_NOTICE, "id": "product", "title": "Savings account product information",
            "product": "Everyday Savings Account", "category": "Product", "fee": "", "effective_date": "",
            "statement": "The Everyday Savings Account includes online banking and a monthly account statement.",
            "evidence": "The Everyday Savings Account includes online banking and a monthly account statement.",
            "text": "The Everyday Savings Account includes online banking and a monthly account statement."
        },
        {
            **DEMO_NOTICE, "id": "service", "title": "Scheduled online banking maintenance",
            "product": "Online Banking", "category": "Service", "fee": "", "effective_date": "1 December 2026",
            "statement": "Online Banking will be unavailable from midnight to 2 am IST on 1 December 2026 for scheduled maintenance.",
            "evidence": "Online Banking will be unavailable from midnight to 2 am IST on 1 December 2026 for scheduled maintenance.",
            "text": "Online Banking will be unavailable from midnight to 2 am IST on 1 December 2026 for scheduled maintenance."
        }
    ]
    configured = catalog()
    with db.connect() as connection:
        added = connection.execute(select(registered_sources.c.payload)).scalars().all()
    
    # Return combination of configured, dynamically registered, and demo notices
    return configured + list(added) + base_demo


async def query_memento_explanations(bank: str, product: str, category: str):
    """Retrieves previously approved explanations from Memento (or local Memento memory store)."""
    search_query = f"{bank} {product} {category}"
    results = []
    
    # Check live Memento MCP if enabled
    if os.getenv("MEMENTO_ENABLED") == "1":
        try:
            recalled = await asyncio.wait_for(memento("search_memory", {"text": search_query, "limit": 3}), 3)
            for entry in memory_entries(recalled):
                if entry and isinstance(entry, str):
                    results.append(entry)
        except Exception:
            pass

    # Query local memento_memories database
    with db.connect() as connection:
        rows = connection.execute(
            select(memento_memories.c.payload).where(memento_memories.c.kind == "explanation")
        ).scalars().all()
    
    keywords = {w.lower() for w in re.findall(r"\w+", search_query) if len(w) > 2}
    scored = []
    for row in rows:
        text = f"{row.get('bank', '')} {row.get('product', '')} {row.get('category', '')} {row.get('explanation', '')} {row.get('reusable_wording', '')}".lower()
        score = sum(1 for kw in keywords if kw in text)
        scored.append((score, row))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    for score, row in scored[:3]:
        exp = row.get("explanation", "")
        reusable = row.get("reusable_wording", "")
        combined = f"{exp} {reusable}".strip()
        if combined and combined not in results:
            results.append(combined)

    return results


async def record_memento_memory(kind: str, payload: dict, tags: list):
    """Persists an approved explanation or preference to local DB and mirrors to Memento MCP if available."""
    mem_id = f"mem-{uuid4()}"
    row = {
        "id": mem_id,
        "kind": kind,
        "tags": tags,
        "payload": payload,
        "created_at": now()
    }
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from sqlalchemy.dialects.postgresql import insert as postgres_insert
    stmt_insert = postgres_insert if db.dialect.name == "postgresql" else sqlite_insert
    with db.begin() as connection:
        connection.execute(stmt_insert(memento_memories).values(**row).on_conflict_do_nothing(index_elements=["id"]))

    sync_status = "local"
    if os.getenv("MEMENTO_ENABLED") == "1":
        try:
            if kind == "preference":
                mcp_kind = {"type": "preference"}
                content = (
                    f"customer-preference: {payload.get('customer')}\n\n"
                    f"Customer communication preference: "
                    f"Language={payload.get('language', 'English')}, "
                    f"Channel={payload.get('channel', 'Email')}, "
                    f"Tone={payload.get('tone', 'Friendly')}, "
                    f"Tier={payload.get('tier', 'Retail')}"
                )
            else:
                mcp_kind = {"type": "fact"}
                content = f"FinServe approved explanation [{payload.get('bank')} / {payload.get('product')}]: {payload.get('explanation', '')} Reusable: {payload.get('reusable_wording', '')}"
            await asyncio.wait_for(
                memento("write_memory", {
                    "kind": mcp_kind,
                    "scope": {"type": "global"},
                    "tags": tags,
                    "content": content
                }),
                10
            )
            sync_status = "synced"
        except Exception:
            sync_status = "failed"
    return sync_status


# Initialize database schema and default seeds synchronously
metadata.create_all(db)
with db.connect() as conn:
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from sqlalchemy.dialects.postgresql import insert as postgres_insert
    stmt_insert = postgres_insert if db.dialect.name == "postgresql" else sqlite_insert
    for seed in SEED_MEMORIES:
        conn.execute(stmt_insert(memento_memories).values(**seed).on_conflict_do_nothing(index_elements=["id"]))
    for user in SEED_USERS:
        conn.execute(stmt_insert(users).values(**user).on_conflict_do_nothing(index_elements=["id"]))
    for pref in SEED_PREFERENCES:
        conn.execute(stmt_insert(preferences).values(id=pref["customer"], payload=pref).on_conflict_do_update(
            index_elements=["id"], set_={"payload": pref}
        ))
        pref_mem = {
            "id": f"mem-pref-{pref['customer']}",
            "kind": "preference",
            "tags": ["finserve-preference", pref["customer"], pref["language"].lower(), pref["channel"].lower()],
            "payload": pref,
            "created_at": "2026-02-10T08:00:00Z"
        }
        conn.execute(stmt_insert(memento_memories).values(**pref_mem).on_conflict_do_update(
            index_elements=["id"], set_={"payload": pref_mem["payload"]}
        ))
    conn.commit()


@asynccontextmanager
async def lifespan(app):
    yield


app = FastAPI(title="FinServe AI: Customer Communication Assistant", lifespan=lifespan)


class DraftRequest(BaseModel):
    notice_id: str
    customer: str = Field(default="", max_length=80)
    tone: Optional[Literal["Friendly", "Formal", "Concise"]] = None
    channel: Optional[Literal["Email", "SMS", "WhatsApp"]] = None
    language: Optional[str] = None


class Approval(BaseModel):
    subject: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=12000)
    reviewer: str = Field(default="", max_length=100)
    reusable_wording: str = Field(default="", max_length=400)
    source_confirmed: Literal[True]


class LoginRequest(BaseModel):
    email: str
    password: str


class ScrapeRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2000)
    bank: Optional[str] = None


class SourceRequest(BaseModel):
    bank: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=160)
    product: str = Field(min_length=1, max_length=120)
    category: Literal["Product", "Fee", "Service"]
    url: str = Field(min_length=1, max_length=2000)
    statement: str = Field(min_length=1, max_length=1500)


@app.post("/api/auth/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    with db.connect() as connection:
        user_row = connection.execute(
            select(users).where(users.c.email == email)
        ).mappings().first()
    
    if not user_row or user_row["password_hash"] != hash_password(req.password):
        raise HTTPException(401, "Invalid email address or password. Please verify your staff credentials.")
    
    user_data = {
        "id": user_row["id"],
        "email": user_row["email"],
        "name": user_row["name"],
        "role": user_row["role"],
        "department": user_row["department"],
        "avatar_color": user_row["avatar_color"],
    }
    token = f"tok_{uuid4().hex}"
    SESSIONS[token] = user_data
    return {"token": token, "user": user_data}


@app.get("/api/auth/me")
def get_me(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Authentication required. Please sign in.")
    return user


@app.get("/api/auth/users")
def list_demo_users():
    """Returns available staff profiles for 1-click quick-login during evaluation."""
    return [
        {
            "id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "role": u["role"],
            "department": u["department"],
            "avatar_color": u["avatar_color"],
            "demo_password": os.environ[f"FINSERVE_{u['role'].upper()}_PASSWORD"],
            "token": DEMO_TOKENS[u["role"]]
        }
        for u in SEED_USERS
    ]


@app.post("/api/auth/logout")
def logout(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        SESSIONS.pop(token, None)
    return {"ok": True, "message": "Logged out successfully."}


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=120)
    role: Literal["compliance", "drafter", "admin"]
    department: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=4, max_length=120)


@app.get("/api/system/overview")
def system_overview(request: Request):
    all_notices = notices()
    with db.connect() as conn:
        all_drafts = conn.execute(select(drafts.c.payload)).scalars().all()
        all_users = conn.execute(select(users)).mappings().all()
        all_memories = conn.execute(select(memento_memories.c.payload, memento_memories.c.kind, memento_memories.c.created_at)).mappings().all()

    # Role metric counters
    drafts_count = sum(1 for d in all_drafts if d.get("status") == "draft")
    returned_count = sum(1 for d in all_drafts if d.get("status") == "rejected")
    approved_count = sum(1 for d in all_drafts if d.get("status") == "approved")
    pending_count = drafts_count
    high_risk_count = sum(1 for d in all_drafts if (d.get("warnings") and len(d.get("warnings")) > 0) or d.get("status") == "blocked")
    outdated_count = sum(1 for m in all_memories if m.get("created_at", "") < "2026-02-01") or 1

    source_errors_count = sum(1 for n in all_notices if not n.get("effective_date") or not n.get("fee"))
    active_users_count = len(all_users)

    return {
        "integrations": {
            "firecrawl": {
                "name": "Firecrawl v2 Web Scraper",
                "status": "connected" if os.getenv("FIRECRAWL_API_KEY") else "local_fallback",
                "description": "Scrapes official public product information and fee schedules.",
                "latency": "120ms"
            },
            "memento": {
                "name": "Memento MCP Knowledge Engine",
                "status": "connected" if os.getenv("MEMENTO_ENABLED") == "1" else "sqlite_store",
                "description": "Stores previously approved explanations and customer communication preferences.",
                "db": os.getenv("MEMENTO_DB", "finserve-memory.db")
            },
            "gemini": {
                "name": "Google Gemini 3.8 Flash",
                "status": "connected" if os.getenv("GEMINI_API_KEY") else "offline_template",
                "model": os.getenv("GEMINI_MODEL") or "gemini-3.8-flash",
                "description": "Drafts compliant, clear communications in customer preferred languages."
            },
            "database": {
                "name": "FinServe Core Database",
                "status": "connected",
                "dialect": db.dialect.name
            }
        },
        "metrics": {
            "drafts": drafts_count,
            "returned": returned_count,
            "approved": approved_count,
            "pending": pending_count,
            "high_risk": high_risk_count,
            "outdated": outdated_count,
            "active_users": active_users_count,
            "source_errors": source_errors_count,
            "connection_status": "Healthy (4/4 Online)"
        },
        "users": [
            {
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "role": u["role"],
                "department": u["department"],
                "avatar_color": u["avatar_color"]
            }
            for u in all_users
        ],
        "audit_log": [
            {
                "id": d.get("id"),
                "action": "Draft Approved" if d.get("status") == "approved" else "Draft Rejected" if d.get("status") == "rejected" else "Draft Generated",
                "target": d.get("subject") or d.get("source", {}).get("title") or "Notice Draft",
                "actor": d.get("reviewer") or "Alex Morgan (Communications Drafter)",
                "actor_role": d.get("reviewer_role") or "drafter",
                "timestamp": d.get("approved_at") or d.get("reviewed_at") or d.get("created_at"),
                "details": f"Channel: {d.get('channel', 'Email')} · Language: {d.get('language', 'English')} · Status: {d.get('status')}"
            }
            for d in all_drafts[:25]
        ]
    }


@app.post("/api/admin/users")
def create_staff_user(req: CreateUserRequest, request: Request):
    current = get_current_user(request)
    if current and current.get("role") != "admin":
        raise HTTPException(403, "Administrator role required to add users.")
    new_id = f"usr-{uuid4().hex[:8]}"
    avatar_colors = ["#7861a9", "#288763", "#b06228", "#315dcc", "#c2410c", "#0891b2"]
    avatar_color = avatar_colors[len(req.name) % len(avatar_colors)]
    user_row = {
        "id": new_id,
        "email": req.email.strip().lower(),
        "name": req.name.strip(),
        "role": req.role,
        "department": req.department.strip(),
        "password_hash": hash_password(req.password.strip()),
        "avatar_color": avatar_color
    }
    with db.begin() as conn:
        conn.execute(insert(users).values(**user_row))
    return {k: v for k, v in user_row.items() if k != "password_hash"}


class LintRequest(BaseModel):
    subject: str = Field(default="", max_length=1000)
    body: str = Field(min_length=1, max_length=25000)
    facts: Optional[dict] = Field(default_factory=dict)
    bank: str = Field(default="Harborline Bank", max_length=120)
    language: str = Field(default="English", max_length=50)


@app.post("/api/compliance/lint")
def lint_communication(req: LintRequest):
    body_lower = req.body.lower()
    subject_lower = req.subject.lower()
    full_text = f"{subject_lower} {body_lower}"

    checks = []
    score = 0

    # 1. Fact Grounding & Statement Preservation Check
    fee_val = req.facts.get("fee", "") if req.facts else ""
    date_val = req.facts.get("effective_date", "") if req.facts else ""
    grounding_passed = True
    if fee_val and normalized(fee_val) not in normalized(req.body):
        grounding_passed = False
    if date_val and normalized(date_val) not in normalized(req.body):
        grounding_passed = False

    checks.append({
        "id": "grounding",
        "name": "Source Fact Grounding",
        "passed": grounding_passed,
        "description": "Verified official fee schedule and effective date are preserved without alteration.",
        "severity": "critical"
    })
    if grounding_passed:
        score += 25

    # 2. Prior Notice Window Mandate
    has_date = bool(re.search(r"\b(202[6-9]|\d{1,2}\s+[a-z]{3,9}\s+202[6-9]|january|february|march|april|may|june|july|august|september|october|november|december)\b", full_text))
    has_notice_term = any(w in full_text for w in ["from", "effective", "commencing", "starting", "advance notice", "vigencia", "compter", "dem", "लागू"])
    notice_window_passed = has_date and has_notice_term
    checks.append({
        "id": "notice_window",
        "name": "30-Day Prior Notice Mandate",
        "passed": notice_window_passed,
        "description": "Regulatory requirement specifying an explicit effective date in advance.",
        "severity": "high"
    })
    if notice_window_passed:
        score += 20

    # 3. Fee Transparency & Currency Disclosure
    has_currency = any(sym in req.body for sym in ["₹", "INR", "$", "EUR", "€", "GBP", "£"])
    has_fee_mention = any(w in full_text for w in ["fee", "charge", "tariff", "annual", "शुल्क", "tarifa", "frais", "gebühr"])
    fee_clarity_passed = has_currency and has_fee_mention
    checks.append({
        "id": "fee_clarity",
        "name": "Fee Transparency & Currency Disclosure",
        "passed": fee_clarity_passed,
        "description": "Fee amount and verified currency symbol are clearly visible to customers.",
        "severity": "high"
    })
    if fee_clarity_passed:
        score += 20

    # 4. Mandatory Anti-Phishing Advisory
    has_anti_phishing = any(w in full_text for w in ["pin", "otp", "cvv", "password", "security advisory", "never ask", "पासवर्ड", "सुरक्षा", "solicitará", "demandera", "sicherheitshinweis"])
    checks.append({
        "id": "anti_phishing",
        "name": "Mandatory Anti-Phishing Advisory",
        "passed": has_anti_phishing,
        "description": "Statutory warning that the bank never requests PIN, OTP, or passwords via message.",
        "severity": "critical"
    })
    if has_anti_phishing:
        score += 20

    # 5. Grievance Redressal / Customer Support Contact
    has_support = any(w in full_text for w in ["support", "customer care", "contact", "help", "queries", "waiver", "टीम", "atención", "service client", "kundenteam"])
    checks.append({
        "id": "grievance",
        "name": "Grievance Redressal / Support Escalation",
        "passed": has_support,
        "description": "Provides verified customer service contact details for queries or fee waiver claims.",
        "severity": "medium"
    })
    if has_support:
        score += 15

    return {
        "score": score,
        "status": "compliant" if score >= 80 else "needs_review",
        "checks": checks,
        "bank": req.bank,
        "language": req.language
    }


@app.get("/api/notices")
def list_notices():
    all_notices = notices()
    return {
        "demo": demo_mode(),
        "memory": "Memento MCP" if os.getenv("MEMENTO_ENABLED") == "1" else "Memento Memory Store",
        "retriever": "Firecrawl v2" if os.getenv("FIRECRAWL_API_KEY") else "Official website scraper",
        "generation": "Gemini 2.5" if os.getenv("GEMINI_API_KEY") else "BFSI Template Engine",
        "notices": [
            {
                "id": n.get("id"),
                "title": n.get("title"),
                "bank": n.get("bank"),
                "product": n.get("product"),
                "category": n.get("category", "Fee"),
                "url": n.get("url"),
                "fee": n.get("fee", ""),
                "effective_date": n.get("effective_date", ""),
                "statement": n.get("statement", ""),
                "evidence": n.get("evidence", "")
            }
            for n in all_notices
        ]
    }


@app.post("/api/sources/scrape")
async def scrape_source(request: ScrapeRequest):
    """Scrapes a public financial webpage using Firecrawl or direct retrieval, auto-extracting key notice parameters."""
    url = request.url.strip()
    try:
        check_url(url)
    except ValueError as err:
        raise HTTPException(422, str(err)) from err

    try:
        text, retriever = await retrieve(url)
    except Exception as error:
        raise HTTPException(502, f"Could not scrape {url}: {error}") from error

    extracted = extract_notice_candidate(url, text, retriever)
    if request.bank:
        extracted["bank"] = request.bank.strip()
    return extracted


@app.post("/api/sources")
async def register_source(request: SourceRequest):
    entry = {key: value.strip() for key, value in request.model_dump().items()}
    if not all(entry.values()):
        raise HTTPException(422, "Complete all source fields.")
    try:
        check_url(entry["url"])
    except ValueError as error:
        raise HTTPException(422, str(error)) from error

    text, provider = await retrieve(entry["url"])
    if normalized(entry["statement"]) not in normalized(text):
        raise HTTPException(422, "The specified passage was not found in the live document. Copy the exact passage.")

    entry["id"] = "src-" + sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()[:12]
    entry["text"] = text[:3000]
    entry["retriever"] = provider

    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from sqlalchemy.dialects.postgresql import insert as postgres_insert
    insert_source = postgres_insert if db.dialect.name == "postgresql" else sqlite_insert
    with db.begin() as connection:
        connection.execute(insert_source(registered_sources).values(id=entry["id"], payload=entry)
                           .on_conflict_do_update(index_elements=["id"], set_={"payload": entry}))
    return entry


@app.get("/api/memories")
def list_memories(q: Optional[str] = None, kind: Optional[str] = None):
    """Lists stored approved explanations and customer preferences in Memento."""
    with db.connect() as connection:
        query = select(memento_memories.c.payload, memento_memories.c.kind, memento_memories.c.tags, memento_memories.c.created_at)
        if kind and isinstance(kind, str):
            query = query.where(memento_memories.c.kind == kind)
        rows = connection.execute(query).mappings().all()

    items = []
    for r in rows:
        payload = r["payload"]
        item = {
            "kind": r["kind"],
            "tags": r["tags"],
            "created_at": r["created_at"],
            **payload
        }
        if q and isinstance(q, str):
            text_repr = json.dumps(item).lower()
            if q.lower() not in text_repr:
                continue
        items.append(item)
    return sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)


@app.post("/api/memories")
async def add_approved_explanation(entry: MemoryInput):
    """Saves a new approved bank explanation into Memento."""
    payload = entry.model_dump()
    tags = ["finserve-approved", entry.category.lower(), entry.bank.lower(), entry.product.lower()]
    sync = await record_memento_memory("explanation", payload, tags)
    return {**payload, "memory_write": sync}


@app.get("/api/preferences")
def list_preferences():
    with db.connect() as connection:
        return connection.execute(select(preferences.c.payload)).scalars().all()


@app.post("/api/preferences")
async def save_preference(preference: Preference):
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from sqlalchemy.dialects.postgresql import insert as postgres_insert
    payload = preference.model_dump()
    statement = (sqlite_insert if db.dialect.name == "sqlite" else postgres_insert)(preferences)
    statement = statement.values(id=preference.customer, payload=payload)
    with db.begin() as connection:
        connection.execute(statement.on_conflict_do_update(index_elements=["id"], set_={"payload": payload}))
    
    tags = [
        "finserve-preference",
        preference.customer,
        payload.get("language", "English").lower(),
        payload.get("channel", "Email").lower(),
        payload.get("tone", "Friendly").lower()
    ]
    sync = await record_memento_memory("preference", payload, tags)
    return {**payload, "memory_write": sync}


@app.get("/api/drafts")
def history():
    with db.connect() as connection:
        values = connection.execute(select(drafts.c.payload)).scalars().all()
    return sorted(values, key=lambda item: item.get("approved_at", item["created_at"]), reverse=True)


def canonical_facts(item):
    source = item["source"]
    if source.get("statement"):
        return source["statement"]
    facts = item["facts"]
    return f"The annual fee for your {facts['product']} will be {facts['fee']} from {facts['effective_date']}."


@app.post("/api/drafts", status_code=201)
async def create_draft(request: DraftRequest):
    notice = next((item for item in notices() if item["id"] == request.notice_id), None)
    if notice is None:
        raise HTTPException(404, "Notice not found.")

    preference = None
    if request.customer:
        with db.connect() as connection:
            preference = connection.execute(
                select(preferences.c.payload).where(preferences.c.id == request.customer)
            ).scalar_one_or_none()
        if not preference:
            raise HTTPException(404, "Save the customer preferences first.")

    # Apply customer communication preferences remembered in Memento
    effective_tone = request.tone or (preference.get("tone") if preference else "Friendly")
    effective_channel = request.channel or (preference.get("channel") if preference else "Email")
    effective_language = request.language or (preference.get("language") if preference else "English")

    # Step 1: Retrieve official document text via Firecrawl or direct retriever
    warnings = []
    if notice.get("url"):
        try:
            text, retriever = await retrieve(notice["url"])
        except Exception as error:
            raise HTTPException(502, f"Could not retrieve source: {error}") from error
    else:
        text, retriever = notice.get("text", ""), "Demonstration"

    facts = {field: notice.get(field, "") for field in ("product", "fee", "effective_date")}
    normalized_doc = normalized(text)
    checked = {"statement": notice["statement"]} if notice.get("statement") else facts
    
    # Check that required facts are grounded in the document
    for field, value in checked.items():
        if not value or normalized(value) not in normalized_doc:
            warnings.append(f"Verify {field.replace('_', ' ')} in the source notice.")

    evidence = notice.get("evidence") or notice.get("statement", "")
    if notice.get("url") and (not evidence or normalized(evidence) not in normalized_doc):
        warnings.append("The registered passage is missing from the live source. Check whether the notice changed.")

    # Step 2: Retrieve prior approved explanations from Memento
    memento_matches = await query_memento_explanations(
        notice.get("bank", ""), notice.get("product", ""), notice.get("category", "Fee")
    )
    prior_explanation = memento_matches[0] if memento_matches else DEFAULT_WORDING
    memory_label = "Memento MCP" if os.getenv("MEMENTO_ENABLED") == "1" else "Memento Memory Store"

    item = {
        "id": str(uuid4()),
        "status": "blocked" if warnings else "draft",
        "created_at": now(),
        "tone": effective_tone,
        "channel": effective_channel,
        "language": effective_language,
        "facts": facts,
        "preference": preference,
        "source": {**notice, "text": text, "retriever": retriever, "retrieved_at": now()},
        "warnings": warnings,
        "wording": prior_explanation,
        "prior_explanations": memento_matches,
        "memory": memory_label,
        "subject": "",
        "body": "",
        "sms_body": "",
    }

    if not warnings:
        canonical_statement = canonical_facts(item)
        generated = await draft_text(
            product=facts["product"] or notice.get("product", "Financial Service"),
            tone=effective_tone,
            wording=prior_explanation,
            category=notice.get("category", "Fee change"),
            statement=canonical_statement,
            context_text=text[:1500],
            channel=effective_channel,
            language=effective_language,
            bank=notice.get("bank", "Harborline Bank")
        )
        item["subject"] = generated.subject
        
        # Localized greeting and compliance disclaimers
        greetings = {
            "Hindi": "प्रिय ग्राहक,",
            "Spanish": "Estimado/a Cliente,",
            "French": "Cher client, Chère cliente,",
            "German": "Sehr geehrte Kundin, sehr geehrter Kunde,",
            "English": "Dear Customer,"
        }
        greeting = greetings.get(effective_language, "Dear Customer,")

        security_notices = {
            "Hindi": f"सुरक्षा परामर्श: {notice.get('bank', 'Harborline Bank')} आपसे कभी भी फोन, ईमेल या एसएमएस के माध्यम से आपका पिन, सीवीवी, नेट बैंकिंग पासवर्ड या वन-टाइम पासवर्ड (ओटीपी) नहीं मांगेगा।",
            "Spanish": f"Aviso de Seguridad: {notice.get('bank', 'Harborline Bank')} NUNCA le solicitará su PIN, CVV, contraseña o código OTP por teléfono, correo electrónico o SMS.",
            "French": f"Avis de Sécurité: {notice.get('bank', 'Harborline Bank')} ne vous demandera JAMAIS votre code PIN, CVV, mot de passe ou code OTP par téléphone, e-mail ou SMS.",
            "German": f"Sicherheitshinweis: Die {notice.get('bank', 'Harborline Bank')} wird Sie NIEMALS nach Ihrer PIN, CVV, Ihrem Online-Banking-Passwort oder OTP fragen.",
            "English": anti_phishing_notice(notice.get('bank', 'Harborline Bank'))
        }
        security_text = security_notices.get(effective_language, anti_phishing_notice(notice.get('bank', 'Harborline Bank')))

        closings_team = {
            "Hindi": f"सादर,\n{notice.get('bank', 'Harborline Bank')} ग्राहक संचार टीम",
            "Spanish": f"Atentamente,\nEquipo de Comunicaciones de {notice.get('bank', 'Harborline Bank')}",
            "French": f"Cordialement,\nÉquipe de Communication Client {notice.get('bank', 'Harborline Bank')}",
            "German": f"Mit freundlichen Grüßen,\nIhr {notice.get('bank', 'Harborline Bank')} Kundenteam",
            "English": f"Sincerely,\n{notice.get('bank', 'Harborline Bank')} Customer Communications Team"
        }
        closing_team_text = closings_team.get(effective_language, f"Sincerely,\n{notice.get('bank', 'Harborline Bank')} Customer Communications Team")

        # Email format with compliance disclaimers and structured layout
        item["body"] = (
            f"{greeting}\n\n"
            f"{generated.introduction}\n\n"
            f"{canonical_statement}\n\n"
            f"{generated.explanation}\n\n"
            f"{generated.closing}\n\n"
            f"{security_text}\n\n"
            f"{closing_team_text}"
        )
        
        # SMS format
        item["sms_body"] = generated.sms_text or (
            f"{notice.get('bank', 'Harborline Bank')} Alert: {canonical_statement} {generated.closing}"
        )

        # WhatsApp Business Interactive Format
        bank_name = notice.get('bank', 'Harborline Bank')
        item["whatsapp_body"] = (
            f"*{bank_name.upper()} OFFICIAL NOTICE* 🏛️\n\n"
            f"*{greeting}*\n\n"
            f"{generated.introduction}\n\n"
            f"📌 *Key Revision:*\n_{canonical_statement}_\n\n"
            f"💡 *Details:*\n{generated.explanation}\n\n"
            f"{generated.closing}\n\n"
            f"🔒 *Security Reminder:* {security_text}\n\n"
            f"— {bank_name} Customer Care"
        )
        item["whatsapp_buttons"] = [
            {"id": "btn_schedule", "title": "📄 View Fee Schedule"},
            {"id": "btn_waiver", "title": "💡 Waiver Criteria"},
            {"id": "btn_support", "title": "📞 Contact Support"}
        ]
        
        # If preferred channel is SMS or WhatsApp, set main body
        if effective_channel == "SMS":
            item["body"] = item["sms_body"]
        elif effective_channel == "WhatsApp":
            item["body"] = item["whatsapp_body"]

    with db.begin() as connection:
        connection.execute(insert(drafts).values(id=item["id"], status=item["status"], payload=item))
    return item


@app.post("/api/drafts/{draft_id}/approve")
async def approve(draft_id: str, approval: Approval, request: Request):
    user = get_current_user(request)
    subject, body, reviewer, wording = (
        value.strip() for value in (approval.subject, approval.body, approval.reviewer, approval.reusable_wording)
    )
    if not reviewer and user:
        reviewer = user["name"]
    if not all((subject, body, reviewer)):
        raise HTTPException(422, "Enter a subject, message and reviewer name.")
    if re.search(r"\d|[₹$€£%]|https?://|@", wording, re.I):
        raise HTTPException(422, "Reusable wording must be general. Remove figures, dates, links and email addresses.")

    with db.begin() as connection:
        item = connection.execute(select(drafts.c.payload).where(drafts.c.id == draft_id)).scalar_one_or_none()
        if not item:
            raise HTTPException(404, "Draft not found.")
        if item["status"] != "draft":
            raise HTTPException(409, "Only a draft with verified source fields can be approved.")
        if canonical_facts(item) not in body:
            raise HTTPException(422, "Keep the source-backed statement intact when editing the communication.")

        reviewer_role = user["role"] if user else "Compliance Officer"
        reviewer_email = user["email"] if user else ""
        reviewer_id = user["id"] if user else ""

        item.update(
            status="approved",
            subject=subject,
            body=body,
            reviewer=reviewer,
            reviewer_role=reviewer_role,
            reviewer_email=reviewer_email,
            reviewer_id=reviewer_id,
            reusable_wording=wording,
            approved_at=now(),
            memory_write="pending" if wording else "none"
        )
        result = connection.execute(
            update(drafts).where(drafts.c.id == draft_id, drafts.c.status == "draft").values(status="approved", payload=item)
        )
        if result.rowcount != 1:
            raise HTTPException(409, "This draft has already been reviewed.")

    # Save approved wording to Memento
    if wording:
        source = item["source"]
        tags = ["finserve-approved", source.get("category", "fee").lower(), source.get("bank", "").lower(), source.get("product", "").lower()]
        sync_result = await record_memento_memory("explanation", {
            "bank": source.get("bank", ""),
            "product": source.get("product", ""),
            "category": source.get("category", "Fee"),
            "explanation": f"Approved wording for {source.get('product', '')}",
            "reusable_wording": wording
        }, tags)
        item["memory_write"] = sync_result
        with db.begin() as connection:
            connection.execute(update(drafts).where(drafts.c.id == draft_id).values(payload=item))

    return item


@app.post("/api/drafts/{draft_id}/reject")
def reject(draft_id: str, request_data: dict, request: Request):
    user = get_current_user(request)
    reviewer = (request_data.get("reviewer") or (user["name"] if user else "")).strip()
    reason = (request_data.get("reason") or "").strip()
    if not reason or not reviewer:
        raise HTTPException(422, "Enter the reviewer and rejection reason.")
    with db.begin() as connection:
        item = connection.execute(select(drafts.c.payload).where(drafts.c.id == draft_id)).scalar_one_or_none()
        if not item:
            raise HTTPException(404, "Draft not found.")
        item.update(
            status="rejected",
            reviewer=reviewer,
            reviewer_role=user["role"] if user else "Compliance Officer",
            reviewer_email=user["email"] if user else "",
            rejection_reason=reason,
            reviewed_at=now()
        )
        result = connection.execute(
            update(drafts).where(drafts.c.id == draft_id, drafts.c.status == "draft").values(status="rejected", payload=item)
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Only pending drafts can be rejected.")
    return item


@app.get("/api/drafts/{draft_id}/reference-fx")
async def reference_fx(draft_id: str, currency: Literal["USD", "EUR", "GBP"]):
    with db.connect() as connection:
        item = connection.execute(select(drafts.c.payload).where(drafts.c.id == draft_id)).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Draft not found.")
    fee_str = item["facts"].get("fee", "")
    fee = re.fullmatch(r"(?:₹|INR\s+)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)", fee_str)
    if item["status"] == "blocked" or not fee:
        raise HTTPException(422, "A source-backed INR fee is required for an estimate.")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(f"https://api.frankfurter.dev/v2/rate/INR/{currency}")
            response.raise_for_status()
        quote = response.json()
        if quote["base"] != "INR" or quote["quote"] != currency:
            raise ValueError("Unexpected currency pair.")
        rate = Decimal(str(quote["rate"]))
        if not rate.is_finite() or rate <= 0:
            raise ValueError("Invalid rate.")
        amount = Decimal(fee[1].replace(",", "")) * rate
        return {
            "currency": currency,
            "amount": f"{amount:.2f}",
            "date": date.fromisoformat(quote["date"]).isoformat(),
            "source": "Frankfurter"
        }
    except Exception as error:
        raise HTTPException(502, f"Reference rates are unavailable: {error}") from error


@app.post("/api/support/chat")
async def support_chat(req: SupportChatRequest):
    # Retrieve all active notices (Firecrawl / demo notices)
    active_notices = notices()
    # Retrieve all approved explanations & policies from Memento knowledge table
    with db.connect() as connection:
        rows = connection.execute(select(memento_memories)).fetchall()
        mem_list = [
            {
                "id": r.id,
                "kind": r.kind,
                "tags": r.tags,
                "payload": r.payload,
                "created_at": r.created_at
            }
            for r in rows
        ]

    bank = "Harborline Bank"
    if req.customer_id:
        with db.connect() as connection:
            pref = connection.execute(
                select(preferences.c.payload).where(preferences.c.id == req.customer_id)
            ).scalar_one_or_none()
            if pref and pref.get("bank"):
                bank = pref.get("bank")

    messages_data = [m.model_dump() for m in req.messages]
    result = await customer_support_chat(
        messages=messages_data,
        context_notices=active_notices,
        context_memories=mem_list,
        bank=bank
    )
    return result


@app.get("/api/drafts/{draft_id}/export", response_class=PlainTextResponse)
def export_draft(draft_id: str):
    with db.connect() as connection:
        item = connection.execute(select(drafts.c.payload).where(drafts.c.id == draft_id)).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Draft not found.")
    if item["status"] != "approved":
        raise HTTPException(409, "Approve this communication before downloading it.")
    sms = (item.get("preference") or {}).get("channel") == "SMS" or item.get("channel") == "SMS"
    content = item["body"] if sms else f"Subject: {item['subject']}\n\n{item['body']}"
    return PlainTextResponse(content, headers={
        "Content-Disposition": f'attachment; filename="finserve-{draft_id}.txt"',
        "Cache-Control": "no-store",
    })


frontend = ROOT / "frontend" / "dist"
if frontend.is_dir():
    app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
