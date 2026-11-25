"""Exercise the HDFC workflow in an isolated database, using the catalog passages offline."""
import asyncio
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException
from starlette.requests import Request


async def run_all_tests():
    from backend import main
    from backend.sources import extract_notice_candidate

    notices = main.list_notices()["notices"]
    assert notices and all(n["bank"] == "HDFC Bank" for n in notices)
    assert not main.list_memories() and not main.list_preferences() and not main.history()
    from backend import load_drafts

    passages = {n["url"]: n["statement"] for n in notices}
    with patch.object(load_drafts, "retrieve", new_callable=AsyncMock) as read_page:
        read_page.side_effect = lambda url: (passages[url], "Official website")
        assert await load_drafts.load_drafts() == len(load_drafts.DRAFTS)
        examples = main.history()
        assert all(d["brief"] and d["source"]["statement"] in d["body"] for d in examples)
        example = examples[0]
        await main.approve(example["id"], main.Approval(
            subject=example["subject"], body=example["body"], reviewer="Test reviewer", source_confirmed=True
        ), Request({"type": "http", "headers": [], "query_string": b""}))
        read_page.reset_mock()
        assert await load_drafts.load_drafts() == 0
        read_page.assert_not_awaited()
        exported = main.export_draft(example["id"]).body.decode()
        assert exported.startswith("Source: ") and example["source"]["url"] in exported
    fee = next(n for n in notices if n["id"] == "online-neft")
    customer = uuid4().hex
    await main.save_preference(main.Preference(customer=customer, language="Hindi", channel="SMS"))
    await main.add_approved_explanation(main.MemoryInput(
        bank=fee["bank"], product=fee["product"], category=fee["category"], explanation=fee["statement"]
    ))
    retrieved = AsyncMock(return_value=(fee["statement"], "Official website"))
    with patch.object(main, "retrieve", retrieved):
        sms = await main.create_draft(main.DraftRequest(notice_id=fee["id"], customer=customer))
        assert sms["language"] == "Hindi" and sms["channel"] == "SMS"
        assert fee["statement"] in sms["body"]
        draft = await main.create_draft(main.DraftRequest(notice_id=fee["id"], language="Spanish"))
        assert draft["status"] == "draft" and fee["statement"] in draft["body"]
        assert "Información" in draft["subject"] and draft["prior_explanations"]
        whatsapp = await main.create_draft(main.DraftRequest(notice_id=fee["id"], channel="WhatsApp"))
        assert whatsapp["whatsapp_buttons"][0]["url"] == fee["url"]
    candidate = extract_notice_candidate(fee["url"], fee["statement"], "Official website")
    assert candidate["statement"] == fee["statement"] and candidate["bank"] == fee["bank"]

    profiles = main.list_demo_users()
    assert len(profiles) == 3
    for profile in profiles:
        assert set(profile) == {"id", "name", "email", "role", "department", "avatar_color"}
        credentials = main.LoginRequest(email=profile["email"], password=os.environ[f"FINSERVE_{profile['role'].upper()}_PASSWORD"])
        session = main.login(credentials)
        assert session["user"]["role"] == profile["role"]
        request = Request({"type": "http", "headers": [(b"authorization", ("Bearer " + session["token"]).encode())]})
        if profile["role"] == "compliance":
            signed = await main.approve(draft["id"], main.Approval(
                subject=draft["subject"], body=draft["body"], reviewer=profile["name"], source_confirmed=True
            ), request)
            assert signed["reviewer_role"] == "compliance"
            assert fee["statement"] in main.export_draft(draft["id"]).body.decode()
        if profile["role"] == "admin":
            assert main.system_overview(request)["metrics"]["active_users"] == len(profiles)
            staff = main.create_staff_user(main.CreateUserRequest(name="Test role", role="drafter",
                department="Testing", email="test@finserve.localhost", password=uuid4().hex), request)
            assert staff["role"] == "drafter"
    try:
        main.login(main.LoginRequest(email=profiles[0]["email"], password=uuid4().hex))
    except HTTPException as error:
        assert error.status_code == 401
    else:
        raise AssertionError("Invalid password accepted")

    for question in ("NEFT charges", "stop cheque", "OTP PIN"):
        result = await main.support_chat(main.SupportChatRequest(messages=[main.ChatMessage(role="user", content=question)]))
        assert result["grounded"] and result["citations"]
        assert all(c["url"] in {n["url"] for n in notices} for c in result["citations"])
    unknown = await main.support_chat(main.SupportChatRequest(messages=[main.ChatMessage(role="user", content="mortgages")]))
    assert not unknown["grounded"]
    lint = main.lint_communication(main.LintRequest(subject=draft["subject"], body=draft["body"], facts=draft["facts"]))
    assert lint["checks"]
    print("HDFC catalog, profiles, preferences, approvals, channel drafts, support and export checks passed.")


if __name__ == "__main__":
    with TemporaryDirectory() as directory:
        settings = {
            "DATABASE_URL": "sqlite:///" + str(Path(directory) / "test.db"),
            "LIVE_NOTICES_FILE": str(Path(__file__).with_name("notices.json").resolve()),
            "GEMINI_API_KEY": "", "FIRECRAWL_API_KEY": "", "MEMENTO_ENABLED": "0",
        }
        settings.update({f"FINSERVE_{role}_PASSWORD": uuid4().hex for role in ("DRAFTER", "COMPLIANCE", "ADMIN")})
        with patch.dict(os.environ, settings):
            try:
                asyncio.run(run_all_tests())
            finally:
                from backend.main import db
                db.dispose()
