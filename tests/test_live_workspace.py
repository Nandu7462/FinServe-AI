import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from sqlalchemy import create_engine

from backend import main


class LiveWorkspaceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        folder = self.enterContext(tempfile.TemporaryDirectory())
        db = create_engine("sqlite:///" + str(Path(folder) / "workflow.db"))
        self.addCleanup(db.dispose)
        self.enterContext(patch.object(main, "db", db))
        self.enterContext(patch.dict(os.environ, {
            "MEMENTO_ENABLED": "0", "GEMINI_API_KEY": "",
        }))
        main.metadata.create_all(db)
        self.source = {k: v for k, v in main.catalog()[0].items() if k != "id"}
        self.enterContext(patch.object(main, "catalog", return_value=[{**self.source, "id": "service"}]))
        self.retrieve = AsyncMock(return_value=(self.source["statement"], "Official website"))
        self.enterContext(patch.object(main, "retrieve", self.retrieve))
        self.client = await self.enterAsyncContext(httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app), base_url="http://test"
        ))

    async def test_register_recheck_and_block_changed_source(self):
        client = self.client
        first = await client.post("/api/sources", json=self.source)
        again = await client.post("/api/sources", json=self.source)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["id"], again.json()["id"])
        self.assertEqual(len((await client.get("/api/notices")).json()["notices"]), 2)
        self.retrieve.return_value = ("Terms revised.", "Official website")
        with patch.object(main, "draft_text", new_callable=AsyncMock) as generate:
            response = await client.post("/api/drafts", json={"notice_id":first.json()["id"]})
            self.assertEqual(response.json()["status"], "blocked")
            generate.assert_not_awaited()
        missing = await client.post("/api/sources", json=self.source)
        self.assertEqual(missing.status_code, 422)
        self.retrieve.reset_mock()
        invalid = await client.post("/api/sources", json={**self.source, "url":"https://elsewhere.example/"})
        self.assertEqual(invalid.status_code, 422)
        self.retrieve.assert_not_awaited()

    async def test_only_approved_message_can_be_exported(self):
        client = self.client
        item = (await client.post("/api/drafts", json={"notice_id":"service"})).json()
        route = "/api/drafts/" + item["id"]
        self.assertEqual((await client.get(route + "/export")).status_code, 409)
        approval = {"subject":item["subject"], "body":item["body"], "reviewer":"Reviewer", "source_confirmed":True}
        changed = await client.post(route + "/approve", json={**approval, "body":"Different conditions."})
        self.assertEqual(changed.status_code, 422)
        self.assertEqual((await client.post(route + "/approve", json=approval)).status_code, 200)
        exported = await client.get(route + "/export")
        self.assertIn(item["body"], exported.text)
        self.assertIn("attachment", exported.headers["Content-Disposition"])
        repeat = await client.post(route + "/reject", json={"reviewer":"Reviewer", "reason":"Changed"})
        self.assertEqual(repeat.status_code, 409)

    async def test_hdfc_only_workspace(self):
        client = self.client
        self.assertEqual((await client.get("/api/preferences")).json(), [])
        self.assertEqual((await client.get("/api/memories")).json(), [])
        for url in ("https://www.hdfc.bank.in.example.org/neft", "https://example.org/neft"):
            result = await client.post("/api/sources/scrape", json={"url": url})
            self.assertEqual(result.status_code, 422)
        mislabeled = {**self.source, "bank": "Other institution"}
        self.assertEqual((await client.post("/api/sources", json=mislabeled)).status_code, 422)
        self.retrieve.assert_not_awaited()
        with patch.object(main, "catalog", return_value=[mislabeled]):
            self.assertEqual((await client.get("/api/notices")).json()["notices"], [])
