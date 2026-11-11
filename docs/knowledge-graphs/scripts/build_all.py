#!/usr/bin/env python3
"""Rebuild every derived ontology artifact, then validate the result.

Stdlib only. Deterministic. Run from anywhere:

    python docs/knowledge-graphs/scripts/build_all.py

Order matters: the registry feeds the prerequisite graph and the lesson
mapping; the audit and the mapping feed the gap analysis.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BUILDERS = [
    'build_registry.py',
    'build_prerequisites.py',
    'build_lesson_mapping.py',
    'build_audit.py',
    'build_gap_analysis.py',
]

VALIDATORS = [
    'validate.py',
    'validate_ontology.py',
]


def run(script):
    path = ROOT / 'scripts' / script
    result = subprocess.run([sys.executable, str(path)], capture_output=True, text=True)
    label = script.ljust(26)
    if result.returncode != 0:
        print('%s FAILED (exit %d)' % (label, result.returncode))
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return False
    print('%s %s' % (label, result.stdout.strip()))
    return True


def main():
    ok = True
    print('--- build ---')
    for script in BUILDERS:
        ok = run(script) and ok
    if not ok:
        print('\nBUILD FAILED')
        return 1
    print('\n--- validate ---')
    for script in VALIDATORS:
        ok = run(script) and ok
    print('\n%s' % ('ALL OK' if ok else 'FAILURES PRESENT'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
