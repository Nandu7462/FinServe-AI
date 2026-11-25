import json
import os
import re
from pathlib import Path

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel, ConfigDict, Field


class DraftText(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject: str = Field(min_length=1, max_length=160)
    introduction: str = Field(min_length=1, max_length=1000)
    explanation: str = Field(default="", max_length=2000)
    closing: str = Field(min_length=1, max_length=1000)
    sms_text: str = Field(default="", max_length=320)


async def fetch_source(url):
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise ValueError("FIRECRAWL_API_KEY is not set.")
    async with httpx.AsyncClient(timeout=50) as client:
        response = await client.post(
            "https://api.firecrawl.dev/v2/scrape",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"url": url, "formats": ["markdown"], "onlyMainContent": True, "maxAge": 0},
        )
        response.raise_for_status()
    data = response.json()["data"]
    metadata = data.get("metadata", {})
    for resolved_url in (metadata.get("sourceURL", ""), metadata.get("url", url)):
        if resolved_url.rstrip("/") != url.rstrip("/"):
            raise ValueError("The source redirected. Configure the final official URL.")
    markdown = data.get("markdown", "")
    if not markdown.strip():
        raise ValueError("The official source returned no text.")
    return markdown


def generate_template_draft(product, tone, wording, category="Product", statement="", bank="HDFC Bank", language="English"):
    labels = {
        "English": ("Information", "Please review the following information.", "For questions, contact HDFC Bank."),
        "Hindi": ("जानकारी", "कृपया निम्नलिखित जानकारी पढ़ें।", "प्रश्नों के लिए HDFC Bank से संपर्क करें।"),
        "Spanish": ("Información", "Consulte la siguiente información.", "Si tiene preguntas, contacte con HDFC Bank."),
        "French": ("Information", "Veuillez consulter les informations suivantes.", "Pour toute question, contactez HDFC Bank."),
        "German": ("Information", "Bitte lesen Sie die folgenden Informationen.", "Bei Fragen wenden Sie sich an HDFC Bank."),
    }
    heading, introduction, contact = labels.get(language, labels["English"])
    if language == "English":
        introduction = {"Friendly": "Here is the information you requested.", "Concise": "Please see the details below."}.get(tone, introduction)
    sms = f"{bank}: {statement}"
    return DraftText(subject=f"{product} | {heading}", introduction=introduction, explanation=wording,
                     closing=contact, sms_text=sms if len(sms) <= 320 else "")


async def draft_text(product, tone, wording, category="Fee change", statement="", context_text="", channel="Email", language="English", bank="HDFC Bank"):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return generate_template_draft(product, tone, wording, category, statement, bank, language=language)
    
    model = os.getenv("GEMINI_MODEL") or "gemini-3.8-flash"
    prompt = {
        "bank": bank,
        "category": category,
        "product": product,
        "tone": tone,
        "channel": channel,
        "customer_language": language or "English",
        "approved_prior_wording": wording,
        "verified_source_statement": statement,
        "context_excerpt": context_text[:1500] if context_text else "",
    }
    
    system_instruction = (
        "You are FinServe AI, an expert banking and financial services (BFSI) customer communication assistant. "
        "Draft consistent, compliant, and transparent customer communications for products, fees, and service changes. "
        "Follow these strict BFSI rules:\n"
        "1. Accuracy: Respect the verified source statement. Never fabricate fee amounts, dates, or terms.\n"
        "2. Prior Approval Consistency: Align your explanation with the approved prior wording provided.\n"
        "3. Tone: Adhere to the selected customer tone (Friendly, Formal, or Concise).\n"
        f"4. Language: The customer's preferred communication language stored in Memento is '{language or 'English'}'. "
        f"Draft ALL components (subject, introduction, explanation, closing, and sms_text) natively and fluently in '{language or 'English'}', "
        f"using standard banking terminology in {language or 'English'}. Never mix languages.\n"
        "5. Structure:\n"
        "   - subject: Clear, professional subject line (under 160 characters).\n"
        "   - introduction: Courteous, contextual opening.\n"
        "   - explanation: Clear rationale or benefit explanation grounded in the notice context and prior approved wording.\n"
        "   - closing: Helpful guidance on support channels.\n"
        "   - sms_text: Concise, compliant SMS version under 160 characters with the verified statement.\n"
    )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseJsonSchema": DraftText.model_json_schema(),
                    },
                },
            )
            response.raise_for_status()
        candidate = response.json()["candidates"][0]
        if candidate.get("finishReason") != "STOP":
            raise ValueError("Gemini did not finish the draft.")
        parts = candidate["content"]["parts"]
        text_content = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        return DraftText.model_validate_json(text_content)
    except Exception as err:
        # Fallback to high quality localized template draft
        return generate_template_draft(product, tone, wording, category, statement, bank, language=language)


async def memento(tool, arguments):
    command = os.getenv("MEMENTO_COMMAND", "npx")
    args = list(json.loads(os.getenv("MEMENTO_ARGS", '["-y","@psraghuveer/memento@0.9.2","serve"]')))
    db_path = str(Path(os.getenv("MEMENTO_DB", "hdfc-memory.db")).resolve())
    if "--db" not in args:
        if "serve" in args:
            idx = args.index("serve")
            args[idx:idx] = ["--db", db_path]
        else:
            args.extend(["--db", db_path])
    env = dict(os.environ)
    env["MEMENTO_DB"] = db_path
    parameters = StdioServerParameters(
        command=command, args=args,
        env=env,
    )
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            result = await session.call_tool(tool, arguments)
    if result.isError:
        raise ValueError("Memento rejected the memory request.")
    if result.structuredContent is not None:
        return result.structuredContent
    for block in result.content:
        if block.type == "text":
            try:
                return json.loads(block.text)
            except json.JSONDecodeError:
                continue
    raise ValueError("Memento returned an unexpected response.")


def memory_entries(value):
    if isinstance(value, dict):
        content = value.get("content")
        if isinstance(content, str):
            yield content
        for nested in value.values():
            yield from memory_entries(nested)
    elif isinstance(value, list):
        for item in value:
            yield from memory_entries(item)


def build_chat_fallback(query: str, notices: list, memories: list, bank: str = "HDFC Bank") -> dict:
    words = set(re.findall(r"[a-z]+", query.casefold()))
    skip = {"a", "an", "the", "what", "is", "are", "how", "in", "i", "on", "for", "to", "can", "do", "my", "of", "hdfc", "bank", "and"}
    matches = []
    for notice in notices:
        terms = set(re.findall(r"[a-z]+", (notice["title"] + " " + notice["product"]).casefold()))
        score = len((words - skip) & terms)
        if score and notice.get("statement") and notice.get("url"):
            matches.append((score, notice))
    if not matches:
        return {"reply": "I could not match that question to an HDFC Bank source in this workspace.",
                "citations": [], "grounded": False, "source": "no_matching_source"}
    best = max(score for score, _ in matches)
    selected = [entry for score, entry in matches if score == best]
    return {
        "reply": "\n\n".join(f"{n['product']}: {n['statement']}" for n in selected),
        "citations": [{"type": "HDFC Bank", "title": n["title"], "reference": n["url"], "url": n["url"]} for n in selected],
        "grounded": True, "source": "official_sources",
    }


async def customer_support_chat(
    messages: list[dict],
    context_notices: list[dict],
    context_memories: list[dict],
    bank: str = "HDFC Bank"
) -> dict:
    # 1. Identify latest user query
    user_query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_query = msg.get("content", "").strip()
            break

    # Build fallback base
    fallback_res = build_chat_fallback(user_query, context_notices, context_memories, bank)

    key = os.getenv("GEMINI_API_KEY")
    if not key or not fallback_res['grounded']:
        return fallback_res

    # Prepare context summaries for Gemini system prompt
    notices_summary = []
    matched_urls = {citation["url"] for citation in fallback_res["citations"]}
    for n in context_notices:
        if n["url"] not in matched_urls:
            continue
        notices_summary.append(
            f"- Title: {n.get('title')}\n"
            f"  URL: {n.get('url')}\n"
            f"  Product: {n.get('product')}\n"
            f"  Category: {n.get('category')}\n"
            f"  Fee: {n.get('fee', 'N/A')}\n"
            f"  Effective Date: {n.get('effective_date', 'N/A')}\n"
            f"  Statement: {n.get('statement')}\n"
            f"  Evidence: {n.get('evidence', '')[:200]}"
        )
    notices_text = "\n\n".join(notices_summary) if notices_summary else "No notices available."

    memories_summary = []
    matched_products = {n["product"] for n in context_notices if n["url"] in matched_urls}
    for m in context_memories[:12]:
        p = m.get("payload", {})
        if p.get("product") not in matched_products or p.get("bank") != bank:
            continue
        memories_summary.append(
            f"- Product: {p.get('product')}\n"
            f"  Category: {p.get('category')}\n"
            f"  Approved Explanation: {p.get('explanation')}\n"
            f"  Approved Reusable Wording: {p.get('reusable_wording')}"
        )
    memories_text = "\n\n".join(memories_summary) if memories_summary else "No memories available."

    system_instruction = (
        f"You are FinServe AI, an independent assistant explaining public information from {bank}.\n"
        f"Your goal is to answer retail and commercial customer inquiries with accuracy, empathy, and strict adherence to bank compliance rules.\n\n"
        f"STRICT COMPLIANCE RULES:\n"
        f"1. FACTUAL GROUNDING: Rely strictly on the Official Product Notices and Approved Knowledge Bank (Memento Memories) provided below. Never invent fees, waiver thresholds, dates, or rates.\n"
        f"2. UNKNOWN DETAILS: If the requested information is not in the notices or approved memories, explicitly state that this detail is not available in current notices, and direct the user to the official HDFC Bank website.\n"
        f"3. ANTI-PHISHING & SECURITY: Remind customers that {bank} will NEVER ask for passwords, ATM PINs, OTPs, or CVV codes. If the user mentions credentials, warn them immediately.\n"
        f"4. CITATIONS: In your response, mention the source of information when referencing policies or fee changes (e.g. 'According to the linked HDFC Bank page' or 'According to our approved card fee policy').\n"
        f"5. FORMATTING: Use structured, pleasant markdown with bullet points and bold highlights.\n\n"
        f"--- OFFICIAL NOTICES (FIRECRAWL) ---\n{notices_text}\n\n"
        f"--- APPROVED KNOWLEDGE BASE (MEMENTO) ---\n{memories_text}\n"
    )

    # Convert conversation turns to Gemini API format (alternating user/model)
    gemini_contents = []
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("content", "").strip()
        if not text:
            continue
        g_role = "model" if role in ("assistant", "model") else "user"
        if gemini_contents and gemini_contents[-1]["role"] == g_role:
            # Merge consecutive turns of same role
            gemini_contents[-1]["parts"][0]["text"] += f"\n\n{text}"
        else:
            gemini_contents.append({"role": g_role, "parts": [{"text": text}]})

    if not gemini_contents:
        return fallback_res

    # Ensure first turn is from user
    if gemini_contents[0]["role"] != "user":
        gemini_contents.insert(0, {"role": "user", "parts": [{"text": "Hello"}]})

    model = os.getenv("GEMINI_MODEL") or "gemini-3.8-flash"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "contents": gemini_contents,
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 800,
                    }
                }
            )
            resp.raise_for_status()
        res_data = resp.json()
        candidates = res_data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            reply_text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
            if reply_text.strip():
                return {
                    "reply": reply_text.strip(),
                    "citations": fallback_res.get("citations", []),
                    "grounded": True,
                    "source": "gemini"
                }
    except Exception:
        pass

    # If Gemini failed or errored out, seamlessly return grounded fallback
    return fallback_res
