"""Custody tests use synthetic text files only; no scientific example data is published."""
import copy
import json
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from scientific_intake import digest, inspect_store, read_json, receive, review, validate


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.file = self.root / 'fixture.txt'
        self.file.write_text('Synthetic custody test. Not scientific data.\n')
        self.store = self.root / 'store'
        self.manifest = self.root / 'manifest.json'
        self.data = {
            'schema_version': 1, 'package_id': 'TEST-ONLY', 'version': 1,
            'previous_manifest_sha256': None, 'area_id': 'test-area', 'title': 'Test only',
            'provider': 'Test runner', 'source_id': 'TEST', 'limitations': 'Synthetic test only',
            'assets': [{'asset_id': 'test-file', 'path': self.file.name,
                        'sha256': digest(self.file), 'size_bytes': self.file.stat().st_size,
                        'kind': 'metadata', 'origin': 'academic', 'license': 'Synthetic fixture',
                        'permissions': {'analysis': 'unknown', 'web_display': 'unknown', 'redistribution': 'unknown'},
                        'capture_time': None, 'capture_unknown_reason': 'No capture for test text',
                        'crs': None, 'crs_unknown_reason': 'Non-spatial test text', 'format': 'text/plain'}]}
        self.save()

    def tearDown(self):
        self.temp.cleanup()

    def save(self):
        self.manifest.write_text(json.dumps(self.data))

    def ingest(self):
        return receive(self.manifest, self.root, self.store)

    def test_receipt_is_copy_and_not_scientific_approval(self):
        receipt = self.ingest()
        self.assertEqual(receipt['scientific_review'], 'pending')
        self.assertFalse(receipt['published'])
        self.file.write_text('Changed original after receipt')
        self.assertEqual(inspect_store(self.store)[0]['asset_count'], 1)

    def test_bad_hash_leaves_no_receipt(self):
        self.data['assets'][0]['sha256'] = '0' * 64
        self.save()
        with self.assertRaisesRegex(ValueError, 'SHA-256 discordante'):
            self.ingest()
        self.assertFalse(self.store.exists())

    def test_size_mismatch(self):
        self.data['assets'][0]['size_bytes'] += 1
        with self.assertRaisesRegex(ValueError, 'Tamaño discordante'):
            validate(self.data, self.root)

    def test_duplicate_ids_and_approval_injection(self):
        bad = copy.deepcopy(self.data)
        bad['assets'].append(bad['assets'][0])
        with self.assertRaisesRegex(ValueError, 'duplicado'):
            validate(bad, self.root)
        self.data['scientific_review'] = 'approved'
        with self.assertRaisesRegex(ValueError, 'desconocidos'):
            validate(self.data, self.root)

    def test_path_escape_and_symlink(self):
        self.data['assets'][0]['path'] = '../fixture.txt'
        with self.assertRaisesRegex(ValueError, 'fuera del paquete'):
            validate(self.data, self.root)
        link = self.root / 'link.txt'
        link.symlink_to(self.file)
        self.data['assets'][0]['path'] = link.name
        with self.assertRaisesRegex(ValueError, 'simbólicos'):
            validate(self.data, self.root)

    def test_unknown_date_requires_reason_and_timezone(self):
        a = self.data['assets'][0]
        a['capture_unknown_reason'] = None
        with self.assertRaisesRegex(ValueError, 'Falta motivo'):
            validate(self.data, self.root)
        a['capture_time'] = '2020-01-01T10:00:00'
        with self.assertRaisesRegex(ValueError, 'zona horaria'):
            validate(self.data, self.root)

    def test_no_overwrite_and_version_chain(self):
        first = self.ingest()
        with self.assertRaisesRegex(ValueError, 'ya recibida'):
            self.ingest()
        self.data['version'] = 2
        self.data['previous_manifest_sha256'] = '0' * 64
        self.save()
        with self.assertRaisesRegex(ValueError, 'Conflicto de versión'):
            self.ingest()
        self.data['previous_manifest_sha256'] = first['manifest_sha256']
        self.save()
        self.ingest()
        self.assertEqual(len(inspect_store(self.store)), 2)

    def test_concurrent_receipts_only_one_wins(self):
        def attempt(_):
            try:
                self.ingest()
                return True
            except ValueError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(attempt, range(2))), [False, True])
        self.assertEqual(len(inspect_store(self.store)), 1)

    def test_review_conflict_and_scientific_separation(self):
        self.ingest()
        review(self.store, 'TEST-ONLY', 1, 0, 'Fixture reviewer', 'request_changes', 'Test notes')
        with self.assertRaisesRegex(ValueError, 'Conflicto'):
            review(self.store, 'TEST-ONLY', 1, 0, 'Other fixture reviewer', 'ready_for_scientist', 'Test')
        with self.assertRaisesRegex(ValueError, 'no valida ciencia'):
            review(self.store, 'TEST-ONLY', 1, 1, 'Fixture reviewer', 'scientifically_validated', 'Test')
        self.assertEqual(inspect_store(self.store)[0]['scientific_review'], 'pending')

    def test_detect_corrupt_stored_copy(self):
        self.ingest()
        (self.store / 'objects' / self.data['assets'][0]['sha256']).write_text('Corrupt')
        with self.assertRaisesRegex(ValueError, 'corrupto'):
            inspect_store(self.store)

    def test_duplicate_json_keys_rejected(self):
        self.manifest.write_text('{"version":1,"version":2}')
        with self.assertRaisesRegex(ValueError, 'duplicada'):
            read_json(self.manifest)


if __name__ == '__main__':
    unittest.main()
