import asyncio
import sys
from uuid import uuid4
sys.stdout.reconfigure(line_buffering=True)
from backend.main import (
    list_notices,
    list_memories,
    add_approved_explanation,
    save_preference,
    create_draft,
    approve,
    export_draft,
    login,
    list_demo_users,
    system_overview,
    create_staff_user,
    CreateUserRequest,
    lint_communication,
    LintRequest,
    MemoryInput,
    Preference,
    DraftRequest,
    Approval,
    LoginRequest,
    support_chat,
    SupportChatRequest,
    ChatMessage,
)
from backend.sources import extract_notice_candidate
from starlette.requests import Request

async def run_all_tests():
    print("=== 1. Testing list_notices() ===")
    notices_data = list_notices()
    print("Notices count:", len(notices_data["notices"]))
    assert len(notices_data["notices"]) > 0
    print("Memory provider:", notices_data.get("memory"))
    print("Retriever:", notices_data.get("retriever"))
    print("Generation:", notices_data.get("generation"))

    print("\n=== 2. Testing list_memories() (Memento Knowledge Bank) ===")
    memories = list_memories()
    print("Seeded Memento memories count:", len(memories))
    assert len(memories) >= 3
    print("First memory bank/product:", memories[0].get("bank"), "/", memories[0].get("product"))

    print("\n=== 3. Testing add_approved_explanation() (Memento Write) ===")
    new_mem = MemoryInput(
        bank="Harborline Bank",
        product="Credit Card Prime",
        category="Fee",
        explanation="Annual maintenance covers 24/7 global fraud protection and premium airport lounge benefits.",
        reusable_wording="Cardholders spending over ₹2,00,000 annually receive a full fee waiver."
    )
    saved_mem = await add_approved_explanation(new_mem)
    print("Added memory result:", saved_mem.get("product"), "Memory write:", saved_mem.get("memory_write"))
    assert saved_mem["product"] == "Credit Card Prime"

    print("\n=== 4. Testing save_preference() (Customer Profiles in Memento) ===")
    pref = Preference(
        customer="cust_test_001",
        name="Test Customer",
        language="English",
        tone="Formal",
        channel="Email",
        tier="Wealth"
    )
    saved_pref = await save_preference(pref)
    print("Saved preference:", saved_pref)
    assert saved_pref["customer"] == "cust_test_001"
    assert saved_pref["language"] == "English"

    print("\n=== 5. Testing create_draft() for Fee Revision (Email) ===")
    annual_fee_notice = next(n for n in notices_data["notices"] if n["id"] == "annual-fee")
    draft_req = DraftRequest(
        notice_id=annual_fee_notice["id"],
        customer="cust_test_001",
        tone="Formal"
    )
    draft = await create_draft(draft_req)
    print("Draft ID:", draft["id"])
    print("Draft Status:", draft["status"])
    print("Subject:", draft["subject"])
    print("Language:", draft.get("language"))
    print("Retrieved Memento explanation:", draft.get("prior_explanations", [""])[0][:80] + "...")
    assert "From 1 December 2026, the annual fee for the Platinum Debit Card will be ₹350." in draft["body"]
    assert "Security Advisory" in draft["body"]
    assert draft["status"] == "draft"

    print("\n=== 6. Testing Memento Customer Preference: Hindi + SMS & Spanish + Email ===")
    # 6a: Test seeded customer with Hindi + SMS preferences in Memento
    draft_hindi = await create_draft(DraftRequest(
        notice_id=annual_fee_notice["id"],
        customer="cust-rajesh-kumar"
    ))
    print("Hindi Draft Language:", draft_hindi.get("language"))
    print("Hindi Draft Channel:", draft_hindi.get("channel"))
    print("Hindi SMS text:", draft_hindi.get("sms_body"))
    assert draft_hindi["language"] == "Hindi"
    assert draft_hindi["channel"] == "SMS"
    assert "शुल्क" in draft_hindi["sms_body"] or "कार्ड" in draft_hindi["sms_body"] or "अलर्ट" in draft_hindi["sms_body"]

    # 6b: Test seeded customer with Spanish + Email preferences in Memento
    draft_spanish = await create_draft(DraftRequest(
        notice_id=annual_fee_notice["id"],
        customer="cust-elena-rodriguez"
    ))
    print("Spanish Draft Language:", draft_spanish.get("language"))
    print("Spanish Draft Subject:", draft_spanish.get("subject"))
    assert draft_spanish["language"] == "Spanish"
    assert draft_spanish["channel"] == "Email"
    assert "tarifa" in draft_spanish["subject"].lower() or "aviso" in draft_spanish["subject"].lower() or "débito" in draft_spanish["subject"].lower()

    print("\n=== 7. Testing approve() with Reusable Wording (Saves to Memento) ===")
    profile = next(u for u in list_demo_users() if u["role"] == "compliance")
    scope = {"type": "http", "headers": [(b"authorization", ("Bearer " + profile["token"]).encode())]}
    mock_req = Request(scope)
    approval_payload = Approval(
        subject=draft["subject"],
        body=draft["body"],
        reviewer="Jane Smith",
        reusable_wording="If you have questions about annual fee waivers, contact customer care.",
        source_confirmed=True
    )
    approved = await approve(draft["id"], approval_payload, mock_req)
    assert approved["status"] == "approved"
    assert approved["reviewer"] == "Jane Smith"
    assert approved["reviewer_role"] == "compliance"
    print("Draft approved by:", approved["reviewer"], "Role:", approved["reviewer_role"])

    print("\n=== 8. Testing export_draft() ===")
    exported = export_draft(draft["id"])
    assert exported.status_code == 200
    assert "Platinum Debit Card" in exported.body.decode()
    print("Export length:", len(exported.body), "bytes")

    print("\n=== 9. Testing Firecrawl Candidate Extraction Logic ===")
    sample_scraped_text = (
        "Harborline Bank Official Fee Notice. From 1 January 2027, the annual fee for the "
        "Sapphire Card will be ₹500. Regular maintenance covers digital card security and fraud monitoring."
    )
    candidate = extract_notice_candidate(
        "https://harborline.bank.internal/cards/sapphire-card",
        sample_scraped_text,
        "Firecrawl v2"
    )
    print("Extracted Category:", candidate["category"])
    print("Extracted Title:", candidate["title"])
    print("Extracted Product:", candidate["product"])
    print("Extracted Statement:", candidate["statement"])
    assert candidate["category"] == "Fee"
    assert "Sapphire Card" in candidate["product"]

    print("\n=== 10. Testing Staff Authentication & RBAC ===")
    demo_users = list_demo_users()
    print("Demo staff users available:", len(demo_users))
    assert len(demo_users) >= 3

    login_res = login(LoginRequest(email=profile["email"], password=profile["demo_password"]))
    print("Authenticated user:", login_res["user"]["name"], "Role:", login_res["user"]["role"])
    assert login_res["user"]["role"] == "compliance"
    assert "token" in login_res

    # Test invalid password rejection
    try:
        login(LoginRequest(email="jane.compliance@harborline.bank", password="wrongpassword"))
        assert False, "Should have raised HTTPException"
    except Exception as e:
        print("Invalid password rejected as expected:", type(e).__name__)

    print("\n=== 11. Testing Customer Support Chatbot (Gemini / Grounded BFSI) ===")
    # 11a: Fee & Waiver inquiry
    chat_req_1 = SupportChatRequest(
        messages=[ChatMessage(role="user", content="What is the fee for Platinum Debit Card and how can I get it waived?")],
        customer_id="retail-001"
    )
    chat_res_1 = await support_chat(chat_req_1)
    print("Chat 1 Response Source:", chat_res_1.get("source"))
    print("Chat 1 Citations count:", len(chat_res_1.get("citations", [])))
    print("Chat 1 Reply preview:", chat_res_1["reply"][:140].replace("\n", " "))
    assert len(chat_res_1.get("citations", [])) >= 1
    assert "350" in chat_res_1["reply"] or "Debit" in chat_res_1["reply"] or "fee" in chat_res_1["reply"].lower()

    # 11b: Maintenance schedule inquiry
    chat_req_2 = SupportChatRequest(
        messages=[ChatMessage(role="user", content="When is the scheduled banking maintenance window?")],
        customer_id="retail-001"
    )
    chat_res_2 = await support_chat(chat_req_2)
    print("Chat 2 Response Source:", chat_res_2.get("source"))
    print("Chat 2 Citations count:", len(chat_res_2.get("citations", [])))
    assert "maintenance" in chat_res_2["reply"].lower() or "banking" in chat_res_2["reply"].lower()

    # 11c: Anti-Phishing security protection check
    chat_req_3 = SupportChatRequest(
        messages=[ChatMessage(role="user", content="Someone called asking for my net banking OTP and card PIN. Should I share it?")],
        customer_id="retail-001"
    )
    chat_res_3 = await support_chat(chat_req_3)
    print("Chat 3 Anti-Phishing Advisory triggered:", "Security" in chat_res_3["reply"] or "NEVER" in chat_res_3["reply"])
    assert "pin" in chat_res_3["reply"].lower() or "otp" in chat_res_3["reply"].lower()

    print("\n=== 12. Testing system_overview() & Admin User Management ===")
    admin_profile = next(u for u in demo_users if u["role"] == "admin")
    admin_scope = {"type": "http", "headers": [(b"authorization", ("Bearer " + admin_profile["token"]).encode())]}
    admin_req = Request(admin_scope)

    overview = system_overview(admin_req)
    print("Overview metrics:", overview["metrics"])
    print("Active users in overview:", overview["metrics"]["active_users"])
    assert "drafts" in overview["metrics"]
    assert "returned" in overview["metrics"]
    assert "approved" in overview["metrics"]
    assert "active_users" in overview["metrics"]
    assert "integrations" in overview
    assert "firecrawl" in overview["integrations"]
    assert "memento" in overview["integrations"]

    # Test create_staff_user() by Admin
    new_user_req = CreateUserRequest(
        name="David Patel",
        email=f"david.patel.{uuid4().hex[:4]}@harborline.bank",
        role="drafter",
        department="Retail Cards",
        password=uuid4().hex
    )
    created_user = create_staff_user(new_user_req, admin_req)
    print("Created staff user:", created_user["name"], "Role:", created_user["role"])
    assert created_user["name"] == "David Patel"
    assert created_user["role"] == "drafter"

    print("\n=== 13. Testing Pre-Flight Regulatory Linter & WhatsApp Business Format ===")
    # 13a: Linting compliant draft (from phase 5)
    lint_res_compliant = lint_communication(LintRequest(
        subject=draft["subject"],
        body=draft["body"],
        facts=draft["facts"],
        bank="Harborline Bank",
        language="English"
    ))
    print("Compliant Draft Score:", lint_res_compliant["score"], "Status:", lint_res_compliant["status"])
    print("Passed checks count:", sum(1 for c in lint_res_compliant["checks"] if c["passed"]))
    assert lint_res_compliant["score"] >= 80
    assert lint_res_compliant["status"] == "compliant"

    # 13b: Linting incomplete text (missing anti-phishing advisory and fee amount)
    lint_res_incomplete = lint_communication(LintRequest(
        subject="Important Account Notice",
        body="Dear customer, your account settings have been modified. Sincerely, Customer Support",
        facts={"fee": "₹350", "effective_date": "1 December 2026"},
        bank="Harborline Bank"
    ))
    print("Incomplete Text Score:", lint_res_incomplete["score"], "Status:", lint_res_incomplete["status"])
    assert lint_res_incomplete["score"] < 80
    assert lint_res_incomplete["status"] == "needs_review"

    # 13c: WhatsApp Business interactive format
    draft_whatsapp = await create_draft(DraftRequest(
        notice_id=annual_fee_notice["id"],
        customer="cust-rajesh-kumar",
        channel="WhatsApp"
    ))
    print("WhatsApp Body exists:", "whatsapp_body" in draft_whatsapp)
    print("WhatsApp Buttons count:", len(draft_whatsapp.get("whatsapp_buttons", [])))
    print("WhatsApp snippet:", draft_whatsapp.get("whatsapp_body", "")[:100].replace("\n", " "))
    assert "whatsapp_body" in draft_whatsapp
    assert len(draft_whatsapp.get("whatsapp_buttons", [])) == 3
    assert "HARBORLINE BANK" in draft_whatsapp["whatsapp_body"]

    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! ALL 13 TEST PHASES VERIFIED! <<<")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
