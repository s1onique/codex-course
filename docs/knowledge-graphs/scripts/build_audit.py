#!/usr/bin/env python3
"""Audit transcription uncertainties without inventing any text.

Stdlib only. Deterministic.

The audit is DERIVED from the transcribed sheets. It never repairs, guesses or
rewrites a reading. Every entry points back to the occurrence id and to the
photograph, so a human author can look at the picture and decide.

Categories:
  low_confidence_reading - the transcription itself flagged confidence < high
  normalized_label       - the normalized label differs from the raw label
  reviewer_note          - a note was recorded by the transcriber
  ambiguous_relation     - a node whose relation to the sheet is not drawn as
                           an arrow (annotates / unlinked_term)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G = ROOT / 'graphs'
OUT = ROOT / 'ontology' / 'audit.json'

# Open questions already recorded in TRANSCRIPTION.md. They are carried over
# verbatim in intent; no new question is invented here.
KNOWN_QUESTIONS = [
    {
        'id': 'Q1',
        'occurrence_id': 'kg03_credentials',
        'question': 'Под словом «креды» имелись в виду credentials / учётные данные?',
        'source': 'TRANSCRIPTION.md — «Вопросы к автору фотографии KG-03»',
        'status': 'open',
    },
    {
        'id': 'Q2',
        'occurrence_id': 'kg03_rdbms',
        'question': 'На листе «Postgress» или сокращённое «Postgres»; нормализация в PostgreSQL подтверждается?',
        'source': 'TRANSCRIPTION.md — «Вопросы к автору фотографии KG-03»',
        'status': 'open',
    },
    {
        'id': 'Q3',
        'occurrence_ids': ['kg03_loki', 'kg03_kibana', 'kg03_elasticsearch',
                           'kg03_ebpf', 'kg03_flamegraphs', 'kg03_keycloak',
                           'kg03_adfs', 'kg03_credentials', 'kg03_rabbitmq', 'kg03_kafka'],
        'question': 'Взаимосвязи подписей с ближайшими ветками подразумеваются, но отдельные стрелки не проведены. Эти связи остаются предположениями.',
        'source': 'TRANSCRIPTION.md — «Вопросы к автору фотографии KG-03»',
        'status': 'open',
    },
]


def main():
    sheets = [json.loads((G / f'kg{i:02}.json').read_text(encoding='utf-8')) for i in (1, 2, 3)]
    combined = json.loads((G / 'combined.json').read_text(encoding='utf-8'))

    annotations = {e['to'] for e in combined['edges'] if e['relation'] == 'annotates'}

    findings = []

    def add(node, sheet, category, evidence, question, status='open'):
        findings.append({
            'finding_id': 'F-%s-%s' % (category.upper()[:6], node['id']),
            'occurrence_id': node['id'],
            'sheet': sheet['graph_id'],
            'source_image': sheet['source_image'],
            'category': category,
            'confidence': node['provenance']['confidence'],
            'normalized_label': node['label'],
            'raw_label': node.get('raw_label'),
            'evidence': evidence,
            'reviewer_note': node.get('review_note'),
            'question': question,
            'status': status,
        })

    for sheet in sheets:
        short = sheet['graph_id'].lower()
        for node in sheet['nodes']:
            conf = node['provenance']['confidence']
            raw = node.get('raw_label')
            note = node.get('review_note')

            if conf != 'high':
                add(node, sheet, 'low_confidence_reading',
                    'provenance.confidence=%s в graphs/%s.json' % (conf, short),
                    'Подтвердить чтение по фотографии: %s' % node['label'])

            if raw is not None and raw.strip() != node['label'].strip():
                add(node, sheet, 'normalized_label',
                    'raw_label сохранён в graphs/%s.json' % short,
                    None, status='resolved_in_transcription')

            if note is not None:
                add(node, sheet, 'reviewer_note',
                    'review_note в graphs/%s.json' % short, None)

            if node['id'] in annotations:
                add(node, sheet, 'ambiguous_relation',
                    'relation=annotates в graphs/combined.json; отдельной стрелки на фото нет',
                    'Подтвердить или снять связь подписи с веткой.')

            if node['kind'] == 'unlinked_term':
                add(node, sheet, 'ambiguous_relation',
                    'kind=unlinked_term в graphs/%s.json' % short,
                    'К какой ветке относится это слово? На фото стрелки нет.')

    audit = {
        'schema_version': '1.0',
        'artifact': 'transcription_audit',
        'status': 'draft_pending_author_review',
        'generator': 'scripts/build_audit.py',
        'policy': {
            'no_invention': (
                'Аудит ничего не дописывает и не исправляет. Он перечисляет места, где '
                'чтение неоднозначно, и оставляет их открытыми до решения автора фотографии.'
            ),
            'evidence_anchor': 'Каждая находка указывает на occurrence_id и исходную фотографию.',
            'raw_is_preserved': 'raw_label никогда не перезаписывается.',
        },
        'counts': {
            'findings': len(findings),
            'open_findings': sum(1 for f in findings if f['status'] == 'open'),
            'by_category': {
                c: sum(1 for f in findings if f['category'] == c)
                for c in sorted({f['category'] for f in findings})
            },
        },
        'findings': findings,
        'explicit_questions': KNOWN_QUESTIONS,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('WROTE %s: findings=%d open=%d by_category=%s'
          % (OUT, audit['counts']['findings'], audit['counts']['open_findings'],
             audit['counts']['by_category']))


if __name__ == '__main__':
    main()
