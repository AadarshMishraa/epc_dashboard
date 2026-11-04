#!/usr/bin/env python3
"""Tests for privacycheck.py. Run: python3 .claude/gx/bin/test_privacycheck.py

Proves CMP-03 still flags real Aadhaar fields and that the inline allow marker is narrow:
prose only, CMP-03 only, documentation or generator paths only, reason required.
"""
import os, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import privacycheck  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MARK = "privacycheck: allow CMP-03 rule text that forbids the field"


def scan_files(files):
    """Write {relpath: text} into a temp root and return (errors, allows)."""
    with tempfile.TemporaryDirectory() as root:
        for rel, text in files.items():
            p = os.path.join(root, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(text)
        allows = []
        hits = privacycheck.scan(root, allows)
    errors = [(rid, p, n) for lvl, rid, p, n, _ in hits if lvl == "ERROR"]
    return errors, allows


class RealFieldsStillFlagged(unittest.TestCase):
    def test_seeded_sql_column(self):
        for col in ("aadhaar_no", "aadhaar_number", "aadhar_num", "aadhaar_id", "aadhaar-no"):
            errs, _ = scan_files({"db/migrations/001.sql": f"CREATE TABLE customer (id uuid, {col} text);\n"})
            self.assertIn(("CMP-03", "db/migrations/001.sql", 1), errs, col)

    def test_code_and_json_identifiers(self):
        errs, _ = scan_files({
            "app/model.ts": "export interface Customer { aadhaarNumber: string }\n",
            "app/form.json": '{"fields": ["name", "aadhaar_number"]}\n',
        })
        self.assertIn(("CMP-03", "app/model.ts", 1), errs)
        self.assertIn(("CMP-03", "app/form.json", 1), errs)

    def test_marker_ignored_outside_doc_or_generator_paths(self):
        errs, allows = scan_files({"db/schema.sql": f"  aadhaar text, -- {MARK}\n"})
        self.assertIn(("CMP-03", "db/schema.sql", 1), errs)
        self.assertEqual(allows, [])

    def test_marker_does_not_cover_identifier_in_generator(self):
        errs, _ = scan_files({"tools/plangen/gen.py": f'COLS = ["aadhaar_no"]  # {MARK}\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)

    def test_marker_does_not_cover_camel_case_identifier(self):
        errs, _ = scan_files({"tools/plangen/gen.py": f'x = "aadhaarNumber"  # {MARK}\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)

    def test_one_identifier_spoils_the_whole_line(self):
        errs, _ = scan_files({"tools/plangen/gen.py": f'x = "Aadhaar is banned, so is aadhaar_id"  # {MARK}\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)

    def test_marker_needs_reason(self):
        errs, _ = scan_files({"tools/plangen/gen.py": '"Do not store Aadhaar numbers."  # privacycheck: allow CMP-03\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)

    def test_marker_for_other_rule_does_not_suppress(self):
        errs, _ = scan_files({"tools/plangen/gen.py": '"Do not store Aadhaar numbers."  # privacycheck: allow CMP-16 wrong rule\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)

    def test_other_rules_on_allowed_line_still_fire(self):
        errs, _ = scan_files({"tools/plangen/gen.py": f'"Aadhaar and cvv are banned"  # {MARK}\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)  # the cvv pattern is CMP-03 too, not prose Aadhaar


class ProseAllowed(unittest.TestCase):
    def test_generator_prose_with_marker_is_suppressed_and_reported(self):
        errs, allows = scan_files({"tools/plangen/gen.py": f'"9. Do not store Aadhaar numbers (CMP-03).\\n"  # {MARK}\n'})
        self.assertEqual(errs, [])
        self.assertEqual(allows, [("CMP-03", "tools/plangen/gen.py", 1, "rule text that forbids the field")])

    def test_generator_prose_without_marker_is_flagged(self):
        errs, _ = scan_files({"tools/plangen/gen.py": '"9. Do not store Aadhaar numbers (CMP-03).\\n"\n'})
        self.assertIn(("CMP-03", "tools/plangen/gen.py", 1), errs)


class Repo(unittest.TestCase):
    def test_repo_is_clean(self):
        hits = privacycheck.scan(REPO)
        self.assertEqual([h for h in hits if h[0] == "ERROR"], [])

    def test_repo_with_seeded_column_is_flagged(self):
        seed = os.path.join(REPO, "tools", "_privacycheck_seed.sql")
        try:
            with open(seed, "w") as f:
                f.write("ALTER TABLE customer ADD COLUMN aadhaar_no text;\n")
            hits = privacycheck.scan(REPO)
        finally:
            os.remove(seed)
        self.assertIn(("ERROR", "CMP-03", os.path.join("tools", "_privacycheck_seed.sql"), 1),
                      [h[:4] for h in hits])


if __name__ == "__main__":
    unittest.main()
