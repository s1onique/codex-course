#!/usr/bin/env python3
"""Build the canonical concept registry from the transcribed sheets.

Stdlib only. Deterministic: the same inputs always yield the same registry.

Design rules (enforced by scripts/validate_ontology.py and tests/):
  * Every occurrence node id in graphs/kg0*.json appears in the registry.
  * No handwritten node is dropped: provenance is never lost.
  * Ambiguous concepts are NOT destructively merged. A registry entry may hold
    several occurrence_ids only when the merge is explicitly declared in
    MERGES below with a documented rationale and a confidence.
  * concept_id is derived from a normalized slug so it is stable across runs
    and independent of the order of nodes in the source files.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G = ROOT / 'graphs'
OUT = ROOT / 'ontology' / 'concepts.json'

# ---------------------------------------------------------------------------
# Explicit, reviewable merge table.
#
# Each entry maps a canonical concept to the occurrence ids it covers.
# `merge_confidence` records how strong the evidence for the merge is.
# Anything not listed here stays a separate concept: no silent merging.
#
# kind: 'exact_duplicate'   - same label and same meaning on two sheets
#       'partial_overlap'   - same concept, non-identical example sets
# ---------------------------------------------------------------------------
MERGES = [
    {
        'concept_id': 'concept_state_storage',
        'kind': 'exact_duplicate',
        'merge_confidence': 'medium',
        'occurrences': ['kg01_state_storage', 'kg03_state_storage'],
        'rationale': (
            'Обе ветки называют хранение состояния приложения. '
            'Различается только контекст листа (действия с кодом / приложение). '
            'Слияние неразрушительное: оба occurrence_id сохранены.'
        ),
        'source_alignment': 'kg01_state_storage -> kg03_state_storage (same_concept_candidate)',
    },
    {
        'concept_id': 'concept_storage_in_files',
        'kind': 'exact_duplicate',
        'merge_confidence': 'medium',
        'occurrences': ['kg01_files', 'kg03_files'],
        'rationale': 'Совпадает формулировка «в файлах» и роль узла.',
        'source_alignment': 'kg01_files -> kg03_files (same_concept_candidate)',
    },
    {
        'concept_id': 'concept_storage_in_cache',
        'kind': 'exact_duplicate',
        'merge_confidence': 'medium',
        'occurrences': ['kg01_cache', 'kg03_cache'],
        'rationale': (
            'Совпадает «в кэше; redis». Гарантии долговременности не обсуждались '
            'ни на одном листе и остаются открытым вопросом.'
        ),
        'source_alignment': 'kg01_cache -> kg03_cache (same_concept_candidate)',
    },
    {
        'concept_id': 'concept_storage_rdbms',
        'kind': 'partial_overlap',
        'merge_confidence': 'medium',
        'occurrences': ['kg01_rdbms', 'kg03_rdbms'],
        'rationale': (
            'Оба узла — «в реляционной СУБД», но списки примеров различаются '
            '(MariaDB есть только на KG03). Примеры не объединяются в один набор: '
            'raw_label каждого вхождения сохранён отдельно.'
        ),
        'source_alignment': 'kg01_rdbms -> kg03_rdbms (overlapping_concepts)',
    },
    {
        'concept_id': 'concept_storage_nosql',
        'kind': 'partial_overlap',
        'merge_confidence': 'medium',
        'occurrences': ['kg01_nosql', 'kg03_nosql'],
        'rationale': (
            'Оба узла — «в NoSQL БД», но списки примеров различаются '
            '(Cassandra есть только на KG03).'
        ),
        'source_alignment': 'kg01_nosql -> kg03_nosql (overlapping_concepts)',
    },
]

# Explicit non-merges: the registry keeps these concepts apart and records why.
# These are pairs that a naive label-based merge would have collapsed.
NON_MERGES = [
    {
        'occurrence_ids': ['kg02_functions', 'kg02_functions_abstract'],
        'reason': (
            'Одинаковая подпись «Функции» на одном листе, но узлы стоят в разных '
            'ветках: «Из чего состоит код?» (состав) и «Какими абстракциями '
            'оперирует код?» (абстракции). Объединение скрыло бы различие.'
        ),
    },
    {
        'occurrence_ids': ['kg02_json', 'kg01_files'],
        'reason': (
            'Совпадение подписи отсутствует, но «JSON» на KG02 — это формат данных, '
            'а не способ хранения состояния. Не объединяются.'
        ),
    },
    {
        'occurrence_ids': ['kg01_files', 'kg02_config'],
        'reason': (
            '«В файлах» (среда выполнения) и «Конфигурационные файлы» (интерфейс '
            'к внешней среде) — разные понятия.'
        ),
    },
    {
        'occurrence_ids': ['kg02_ast', 'kg02_assembler'],
        'reason': (
            'Assembler написан рядом с IR, но отношение неочевидно; уверенность '
            'чтения medium. Оставлены отдельными до подтверждения автора.'
        ),
    },
]

# Pairs whose labels are close enough to invite a naive merge; the registry
# records them explicitly so a reviewer can check the decision.
SAME_LABEL_SEPARATE_IDS = [
    ['kg01_state_storage', 'kg03_state_storage'],
    ['kg01_files', 'kg03_files'],
    ['kg01_cache', 'kg03_cache'],
    ['kg01_rdbms', 'kg03_rdbms'],
    ['kg01_nosql', 'kg03_nosql'],
]

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}


def slugify(text):
    """Deterministic ASCII-ish slug that keeps the id readable and stable."""
    text = text.lower().strip()
    out = []
    for ch in text:
        if ch.isascii() and (ch.isalnum() or ch in ' -_/'):
            out.append(ch)
        elif ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif unicodedata.category(ch).startswith('M'):
            continue
        else:
            out.append(' ')
    text = ''.join(out)
    text = re.sub(r'[^a-z0-9]+', '_', text)
    text = re.sub(r'_+', '_', text).strip('_')
    return text


def normalize_label(label):
    """Normalized form used only for identity comparison, never for display."""
    text = label.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace('ё', 'е')
    return text


def main():
    sheets = [json.loads((G / f'kg{i:02}.json').read_text(encoding='utf-8')) for i in (1, 2, 3)]
    occurrences = {}
    for sheet in sheets:
        for node in sheet['nodes']:
            occurrences[node['id']] = {'node': node, 'sheet': sheet}

    merged_ids = set()
    merged_members = {}
    for merge in MERGES:
        for occ in merge['occurrences']:
            assert occ not in merged_ids, 'overlapping merge entry for %s' % occ
            merged_ids.add(occ)
            merged_members[occ] = merge['concept_id']

    # --- build registry entries -------------------------------------------
    # Identity rule: a concept is NEVER formed by accident. Two occurrences
    # share a concept_id only when the merge is declared in MERGES above.
    # Otherwise each occurrence keeps its own concept, and a slug collision is
    # broken deterministically by appending the sheet-qualified occurrence id.
    entries = {}
    occurrence_to_concept = {}
    slug_taken = set()
    for occ_id, data in occurrences.items():
        node = data['node']
        if occ_id in merged_members:
            concept_id = merged_members[occ_id]
        else:
            base = 'concept_' + slugify(node['label'])
            concept_id = base
            if concept_id in slug_taken:
                # Deterministic disambiguation; never a silent merge.
                concept_id = '%s__%s' % (base, occ_id)
                assert concept_id not in slug_taken, 'concept id collision: %s' % concept_id
            slug_taken.add(concept_id)
        occurrence_to_concept[occ_id] = concept_id
        entry = entries.get(concept_id)
        if entry is None:
            entry = entries[concept_id] = {
                'concept_id': concept_id,
                'canonical_label': node['label'],
                'normalized_label': normalize_label(node['label']),
                'kind': node['kind'],
                'occurrence_ids': [],
                'sheets': [],
                'merge_kind': 'single_occurrence',
                'merge_confidence': None,
                'merge_rationale': None,
                'source_alignments': [],
            }
        entry['occurrence_ids'].append(occ_id)
        if data['sheet']['graph_id'] not in entry['sheets']:
            entry['sheets'].append(data['sheet']['graph_id'])
        if node['kind'] != entry['kind']:
            entry.setdefault('kind_variants', []).append(
                {'occurrence_id': occ_id, 'kind': node['kind']})

    for merge in MERGES:
        entry = entries[merge['concept_id']]
        entry['merge_kind'] = merge['kind']
        entry['merge_confidence'] = merge['merge_confidence']
        entry['merge_rationale'] = merge['rationale']
        entry['source_alignments'] = [merge['source_alignment']]

    # --- occurrences payload (full provenance, nothing dropped) -----------
    occ_records = []
    for occ_id in sorted(occurrences):
        data = occurrences[occ_id]
        node = data['node']
        record = {
            'occurrence_id': occ_id,
            'concept_id': occurrence_to_concept[occ_id],
            'sheet': data['sheet']['graph_id'],
            'label': node['label'],
            'normalized_label': normalize_label(node['label']),
            'kind': node['kind'],
            'provenance': node['provenance'],
        }
        if 'raw_label' in node:
            record['raw_label'] = node['raw_label']
        if 'review_note' in node:
            record['review_note'] = node['review_note']
        occ_records.append(record)

    registry = {
        'schema_version': '1.0',
        'artifact': 'canonical_concept_registry',
        'status': 'draft_pending_author_review',
        'generator': 'scripts/build_registry.py',
        'sources': {
            'sheets': [
                {
                    'graph_id': s['graph_id'],
                    'title': s['title'],
                    'source_image': s['source_image'],
                    'source_original': s.get('source_original'),
                    'node_count': len(s['nodes']),
                    'edge_count': len(s['edges']),
                }
                for s in sheets
            ],
        },
        'policy': {
            'evidence_layers': {
                'handwriting': 'Строка или стрелка реально присутствует на фотографии листа.',
                'interpretation': 'Наша интерпретация: чтение, нормализация, слияние, статус.',
                'pedagogical_proposal': 'Предложение для курса: не факт и не рукопись.',
            },
            'no_destructive_merge': (
                'Каждое handwritten-вхождение сохранено. Слияние только там, где оно '
                'явно перечислено в MERGES; неоднозначные понятия остаются отдельными.'
            ),
            'identity': (
                'concept_id детерминированно выводится из нормализованной подписи; '
                'для слитых групп идентификатор зафиксирован явно.'
            ),
        },
        'counts': {
            'occurrence_count': len(occ_records),
            'concept_count': len(entries),
            'merged_concept_count': sum(
                1 for e in entries.values() if e['merge_kind'] != 'single_occurrence'),
            'single_occurrence_concept_count': sum(
                1 for e in entries.values() if e['merge_kind'] == 'single_occurrence'),
        },
        'concepts': [entries[cid] for cid in sorted(entries)],
        'occurrences': occ_records,
        'declared_non_merges': NON_MERGES,
        'same_label_separate_ids': SAME_LABEL_SEPARATE_IDS,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('WROTE %s: occurrences=%d concepts=%d (merged=%d)'
          % (OUT, registry['counts']['occurrence_count'], registry['counts']['concept_count'],
             registry['counts']['merged_concept_count']))


if __name__ == '__main__':
    main()
