"""Local custody and technical review of scientific packages; never publishes data.

Python 3.12+, standard library only. Scientific validation is deliberately separate.
"""
import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_STORE = PROJECT / 'work' / 'scientific-intake'
KINDS = {'metadata', 'imagery', 'shorelines', 'transects', 'positions',
         'structures', 'vegetation', 'field', 'bathymetry', 'methodology'}
PERMISSIONS = {'analysis', 'web_display', 'redistribution'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def read_json(path):
    def unique(pairs):
        result = {}
        for k, v in pairs:
            require(k not in result, f'Clave JSON duplicada: {k}')
            result[k] = v
        return result
    return json.loads(path.read_text(), object_pairs_hook=unique)


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def validate(manifest, assets_root):
    require(isinstance(manifest, dict), 'El manifiesto debe ser un objeto')
    required = {'schema_version', 'package_id', 'version', 'previous_manifest_sha256',
                'area_id', 'title', 'provider', 'source_id', 'assets', 'limitations'}
    require(set(manifest) == required, 'Campos de manifiesto incompletos o desconocidos')
    require(type(manifest['schema_version']) is int and manifest['schema_version'] == 1,
            'Versión de esquema no compatible')
    require(isinstance(manifest['package_id'], str) and
            re.fullmatch(r'[A-Za-z0-9_-]{1,100}', manifest['package_id']), 'package_id inválido')
    require(type(manifest['version']) is int and manifest['version'] > 0, 'Versión inválida')
    previous = manifest['previous_manifest_sha256']
    require((manifest['version'] == 1 and previous is None) or
            (manifest['version'] > 1 and isinstance(previous, str) and
             re.fullmatch('[a-f0-9]{64}', previous)), 'La versión debe enlazar a su predecesora')
    for field in ['area_id', 'title', 'provider', 'source_id', 'limitations']:
        require(nonempty(manifest[field]), f'Falta {field}')
    require(isinstance(manifest['assets'], list) and manifest['assets'], 'Paquete sin archivos')
    seen = set()
    paths = []
    root = assets_root.resolve(strict=True)
    for a in manifest['assets']:
        fields = {'asset_id', 'path', 'sha256', 'size_bytes', 'kind', 'origin',
                  'license', 'permissions', 'capture_time', 'capture_unknown_reason',
                  'crs', 'crs_unknown_reason', 'format'}
        require(isinstance(a, dict) and set(a) == fields, 'Campos de archivo incompletos o desconocidos')
        require(nonempty(a['asset_id']) and a['asset_id'] not in seen, 'ID de archivo vacío o duplicado')
        seen.add(a['asset_id'])
        require(a['kind'] in KINDS, 'Tipo de archivo no reconocido')
        require(a['origin'] in {'official', 'academic', 'field'}, 'Origen no reconocido')
        require(nonempty(a['license']) and nonempty(a['format']), 'Falta licencia o formato')
        require(isinstance(a['permissions'], dict) and set(a['permissions']) == PERMISSIONS,
                'Declarar los tres permisos por separado')
        require(all(v in {'unknown', 'allowed', 'denied'} for v in a['permissions'].values()),
                'Permiso inválido')
        for field, reason in [('capture_time', 'capture_unknown_reason'), ('crs', 'crs_unknown_reason')]:
            if a[field] is None:
                require(nonempty(a[reason]), f'Falta motivo para {field} desconocido')
            else:
                require(nonempty(a[field]) and a[reason] is None, f'{field} contradictorio')
        if a['capture_time'] is not None:
            dt = datetime.fromisoformat(a['capture_time'].replace('Z', '+00:00'))
            require(dt.tzinfo is not None and dt <= datetime.now(timezone.utc),
                    'Captura futura o sin zona horaria')
        require(nonempty(a['path']), 'Ruta vacía')
        rel = Path(a['path'])
        require(not rel.is_absolute() and '..' not in rel.parts, 'Ruta fuera del paquete')
        source = root / rel
        require(source.resolve(strict=True).is_relative_to(root) and source.is_file(),
                'Archivo fuera del paquete o no regular')
        require(not any(p.is_symlink() for p in [source, *source.parents] if p != root.parent),
                'No se aceptan enlaces simbólicos')
        require(type(a['size_bytes']) is int and a['size_bytes'] >= 0, 'Tamaño inválido')
        require(isinstance(a['sha256'], str) and re.fullmatch('[a-f0-9]{64}', a['sha256']),
                'SHA-256 inválido')
        require(source.stat().st_size == a['size_bytes'], f'Tamaño discordante: {a["asset_id"]}')
        require(digest(source) == a['sha256'], f'SHA-256 discordante: {a["asset_id"]}')
        paths.append(source)
    canonical(manifest)  # Reject non-finite numbers before custody.
    return paths


def connect(store):
    store = store.resolve()
    require(not store.is_relative_to(PROJECT / 'public'), 'El almacén no puede estar en public/')
    store.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(store / 'receipts.sqlite', timeout=20)
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript('''
      CREATE TABLE IF NOT EXISTS packages (
        package_id TEXT NOT NULL, version INTEGER NOT NULL,
        manifest_sha256 TEXT NOT NULL, manifest TEXT NOT NULL,
        received_at TEXT NOT NULL, PRIMARY KEY(package_id, version));
      CREATE TABLE IF NOT EXISTS reviews (
        package_id TEXT NOT NULL, version INTEGER NOT NULL, revision INTEGER NOT NULL,
        reviewer TEXT NOT NULL, decision TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(package_id, version, revision),
        FOREIGN KEY(package_id, version) REFERENCES packages(package_id, version));
    ''')
    return db


def receive(manifest_path, assets_root, store):
    manifest = read_json(manifest_path)
    paths = validate(manifest, assets_root)
    encoded = canonical(manifest)
    signature = hashlib.sha256(encoded.encode()).hexdigest()
    db = connect(store)
    try:
        db.execute('BEGIN IMMEDIATE')
        key = (manifest['package_id'], manifest['version'])
        existing = db.execute('SELECT manifest_sha256 FROM packages WHERE package_id=? AND version=?', key).fetchone()
        require(existing is None, 'Versión ya recibida; use verify o entregue una nueva versión')
        latest = db.execute('SELECT version, manifest_sha256 FROM packages WHERE package_id=? ORDER BY version DESC LIMIT 1',
                            (key[0],)).fetchone()
        require((latest is None and key[1] == 1) or
                (latest and key[1] == latest[0] + 1 and manifest['previous_manifest_sha256'] == latest[1]),
                'Conflicto de versión: comprobar la última recepción antes de continuar')
        objects = store / 'objects'
        objects.mkdir(exist_ok=True)
        # Only complete, rehashed copies become stored objects. Failed transactions may
        # leave unreferenced objects; they never create a successful package receipt.
        for asset, source in zip(manifest['assets'], paths):
            target = objects / asset['sha256']
            if not target.exists():
                with tempfile.NamedTemporaryFile(dir=objects, delete=False) as temp:
                    temp_path = Path(temp.name)
                try:
                    shutil.copyfile(source, temp_path)
                    require(temp_path.stat().st_size == asset['size_bytes'] and digest(temp_path) == asset['sha256'],
                            'El archivo cambió durante la recepción')
                    temp_path.replace(target)
                finally:
                    temp_path.unlink(missing_ok=True)
            require(target.is_file() and not target.is_symlink() and
                    target.stat().st_size == asset['size_bytes'] and digest(target) == asset['sha256'],
                    'Objeto almacenado corrupto; no se sobrescribe')
        db.execute('INSERT INTO packages VALUES (?,?,?,?,?)', (*key, signature, encoded, utc_now()))
        db.commit()
        return {'package_id': key[0], 'version': key[1], 'manifest_sha256': signature,
                'custody': 'received', 'technical_review': 'pending', 'scientific_review': 'pending',
                'published': False, 'asset_count': len(paths)}
    finally:
        db.close()


def inspect_store(store):
    db = connect(store)
    result = []
    try:
        for pid, version, sha, raw, received in db.execute('SELECT * FROM packages ORDER BY package_id, version'):
            require(hashlib.sha256(raw.encode()).hexdigest() == sha, 'Manifiesto almacenado corrupto')
            m = json.loads(raw)
            for a in m['assets']:
                p = store / 'objects' / a['sha256']
                require(p.is_file() and not p.is_symlink() and p.stat().st_size == a['size_bytes'] and
                        digest(p) == a['sha256'], f'Archivo recibido corrupto: {a["asset_id"]}')
            reviews = [dict(zip(['revision', 'reviewer', 'decision', 'notes', 'created_at'], r)) for r in
                       db.execute('SELECT revision, reviewer, decision, notes, created_at FROM reviews WHERE package_id=? AND version=? ORDER BY revision', (pid, version))]
            result.append({'package_id': pid, 'version': version, 'manifest_sha256': sha,
                           'received_at': received, 'asset_count': len(m['assets']), 'reviews': reviews,
                           'scientific_review': 'pending', 'published': False})
    finally:
        db.close()
    return result


def review(store, package_id, version, expected_revision, reviewer, decision, notes):
    require(nonempty(reviewer) and nonempty(notes), 'Identificar revisor y motivo')
    require(decision in {'ready_for_scientist', 'request_changes'}, 'Solo revisión técnica; no valida ciencia')
    db = connect(store)
    try:
        db.execute('BEGIN IMMEDIATE')
        require(db.execute('SELECT 1 FROM packages WHERE package_id=? AND version=?',
                           (package_id, version)).fetchone(), 'Paquete no recibido')
        current = db.execute('SELECT COALESCE(MAX(revision),0) FROM reviews WHERE package_id=? AND version=?',
                             (package_id, version)).fetchone()[0]
        require(current == expected_revision, 'Conflicto: otra revisión se registró; vuelva a leer el historial')
        db.execute('INSERT INTO reviews VALUES (?,?,?,?,?,?,?)',
                   (package_id, version, current + 1, reviewer, decision, notes, utc_now()))
        db.commit()
        return {'revision': current + 1, 'decision': decision, 'scientific_review': 'pending'}
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--store', type=Path, default=DEFAULT_STORE)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ['validate', 'receive']:
        p = sub.add_parser(command)
        p.add_argument('manifest', type=Path)
        p.add_argument('--assets-root', type=Path, required=True)
    sub.add_parser('verify')
    p = sub.add_parser('review')
    p.add_argument('package_id')
    p.add_argument('--version', type=int, required=True)
    p.add_argument('--expected-revision', type=int, required=True)
    p.add_argument('--reviewer', required=True)
    p.add_argument('--decision', choices=['ready_for_scientist', 'request_changes'], required=True)
    p.add_argument('--notes', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'validate':
            result = {'valid': True, 'files_checked': len(validate(read_json(args.manifest), args.assets_root)),
                      'scope': 'Manifest and file integrity only; scientific review pending'}
        elif args.command == 'receive':
            result = receive(args.manifest, args.assets_root, args.store)
        elif args.command == 'verify':
            result = inspect_store(args.store)
        else:
            result = review(args.store, args.package_id, args.version, args.expected_revision,
                            args.reviewer, args.decision, args.notes)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError, sqlite3.Error, TypeError, KeyError) as exc:
        print(f'No completado: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
