"""Load HDFC communication drafts into the configured workspace after checking HDFC's sources."""
import asyncio

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from . import main
from .sources import normalized, retrieve


DRAFTS = (
    ("online-neft", "SMS", "Nila", "Charges for an online NEFT transfer",
     "Explain online NEFT charges for a retail savings account.",
     "You asked what HDFC Bank charges for an online NEFT transfer from your savings account."),
    ("rd-nre-tenure", "Email", "Meera", "Minimum tenure for your NRE recurring deposit",
     "Clarify whether a nine-month NRE recurring deposit earns interest.",
     "Thank you for asking about a nine-month term. Here is the condition HDFC Bank publishes for earning interest."),
    ("fixed-deposit-estimate", "Email", "Kabir", "Reading your fixed deposit estimate",
     "Explain how to interpret a fixed deposit calculator estimate.",
     "You asked whether the figure on the calculator is the amount you will receive. HDFC Bank explains the estimate this way."),
    ("positive-pay-cts", "Email", "Anika", "Positive Pay for your cheque",
     "Explain the Positive Pay clearing and value conditions for a Rs. 60,000 cheque.",
     "For your planned cheque, the clearing method matters as well as the amount. HDFC Bank gives this condition for Positive Pay."),
    ("rtgs-minimum", "WhatsApp", "Dev", "Checking the RTGS minimum",
     "Check the RTGS minimum for a proposed ₹1.5 lakh transfer.",
     "The ₹1.5 lakh transfer you described is below the RTGS minimum."),
    ("upi-receive", "SMS", "Diya", "A PIN request before receiving money",
     "Explain whether receiving a refund requires a UPI PIN.",
     "You asked about a PIN request for your refund."),
    ("credit-card-controls", "WhatsApp", "Ravi", "Card controls before travel",
     "Explain which credit card settings can be adjusted in MyCards before travel.",
     "In the MyCards instructions, HDFC Bank lists the following settings."),
)


def migrate_draft_labels(connection):
    for notice_id, _, _, _, brief, _ in DRAFTS:
        previous_id = f"sample-{notice_id}"
        payload = connection.execute(
            select(main.drafts.c.payload).where(main.drafts.c.id == previous_id).with_for_update()
        ).scalar_one_or_none()
        if not payload or "sample_scenario" not in payload:
            continue
        del payload["sample_scenario"]
        payload.update(id=f"draft-{notice_id}", brief=brief)
        payload["source"]["text"] = payload["source"]["statement"]
        connection.execute(update(main.drafts).where(main.drafts.c.id == previous_id)
                           .values(id=payload["id"], payload=payload))


async def load_drafts():
    entries = {n["id"]: n for n in main.notices()}
    with main.db.begin() as connection:
        migrate_draft_labels(connection)
        existing = set(connection.execute(select(main.drafts.c.id)).scalars())
    records = []
    for notice_id, channel, name, subject, brief, opening in DRAFTS:
        draft_id = f"draft-{notice_id}"
        if draft_id in existing:
            continue
        notice = entries[notice_id]
        text, retriever = await retrieve(notice["url"])
        passage = notice["statement"]
        if not passage or normalized(passage) not in normalized(text):
            raise ValueError(f"Source passage changed for {notice_id}. Review the catalog before loading drafts.")
        timestamp = main.now()
        greeting = f"Hello {name},"
        sms = f"{name}, {passage}"
        chat = f"{greeting}\n\n{opening}\n\n{passage}"
        email = f"{chat}\n\nYou can read the full guidance here:\n{notice['url']}"
        body = {"Email": email, "SMS": sms, "WhatsApp": chat}[channel]
        payload = {
            "id": draft_id, "brief": brief, "status": "draft", "created_at": timestamp,
            "channel": channel, "tone": "Friendly", "language": "English", "preference": None,
            "subject": subject, "body": body, "sms_body": sms, "whatsapp_body": chat,
            "facts": {key: notice.get(key, "") for key in ("product", "fee", "effective_date")},
            "source": {**notice, "text": passage, "retriever": retriever, "retrieved_at": timestamp},
            "wording": "", "warnings": [], "prior_explanations": [],
        }
        records.append({"id": draft_id, "status": "draft", "payload": payload})

    if not records:
        return 0
    with main.db.begin() as connection:
        insert = postgres_insert if connection.dialect.name == "postgresql" else sqlite_insert
        result = connection.execute(insert(main.drafts).values(records).on_conflict_do_nothing(
            index_elements=["id"]
        ))
        return result.rowcount


if __name__ == "__main__":
    print(f"Added {asyncio.run(load_drafts())} drafts.")
