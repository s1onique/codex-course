#!/usr/bin/env python3
"""Build the coverage / gap analysis from the ontology artifacts.

Stdlib only. Deterministic.

Every number in the report is computed here from the JSON artifacts, so the
report cannot drift away from the data. Every row carries the evidence that
produced it (occurrence ids, lesson ids, or the traced curriculum phase).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ONT = ROOT / 'ontology'
OUT = ONT / 'gap-analysis.json'
MD = ONT / 'gap-analysis.md'


def main():
    registry = json.loads((ONT / 'concepts.json').read_text(encoding='utf-8'))
    prereq = json.loads((ONT / 'prerequisites.json').read_text(encoding='utf-8'))
    mapping = json.loads((ONT / 'lesson-mapping.json').read_text(encoding='utf-8'))
    audit = json.loads((ONT / 'audit.json').read_text(encoding='utf-8'))

    concepts = {c['concept_id']: c for c in registry['concepts']}
    occurrences = {o['occurrence_id']: o for o in registry['occurrences']}

    # --- coverage by lesson ---------------------------------------------
    by_lesson = {}
    for record in mapping['mapping']:
        for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
            for entry in record[relation]:
                slot = by_lesson.setdefault(entry['lesson_id'], {
                    'lesson_id': entry['lesson_id'],
                    'lesson_file': entry['lesson_file'],
                    'status': entry['status'],
                    'introduced_in': [], 'practiced_in': [], 'assessed_in': [],
                })
                slot[relation].append(record['concept_id'])

    # --- gaps ------------------------------------------------------------
    gaps = []
    for concept_id in mapping['uncovered_concepts']:
        concept = concepts[concept_id]
        gaps.append({
            'concept_id': concept_id,
            'label': concept['canonical_label'],
            'kind': concept['kind'],
            'occurrence_ids': concept['occurrence_ids'],
            'source_images': sorted({
                occurrences[o]['sheet'] for o in concept['occurrence_ids']}),
            'gap_type': 'no_lesson_coverage',
            'severity': 'high' if concept['kind'] in ('concept', 'topic') else 'low',
            'note': 'Ни один существующий урок это понятие не покрывает; '
                    'покрытие не заявлено и не выдумано.',
        })

    # concepts that are only *proposed* -> weaker than verified
    proposed_only = []
    for record in mapping['mapping']:
        statuses = set()
        for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
            for entry in record[relation]:
                statuses.add(entry['status'])
        if statuses == {'proposed'}:
            proposed_only.append(record['concept_id'])

    # --- audit-linked uncertainty ----------------------------------------
    uncertain = sorted({f['occurrence_id'] for f in audit['findings']
                        if f['status'] == 'open'})
    uncertain_concepts = sorted({
        occurrences[o]['concept_id'] for o in uncertain if o in occurrences})

    # --- sheet-level roll-up ---------------------------------------------
    sheet_rows = []
    for sheet in registry['sources']['sheets']:
        gid = sheet['graph_id']
        sheet_concepts = [c['concept_id'] for c in registry['concepts']
                          if gid in c['sheets']]
        mapped = [c for c in sheet_concepts if c not in mapping['uncovered_concepts']]
        sheet_rows.append({
            'sheet': gid,
            'title': sheet['title'],
            'source_image': sheet['source_image'],
            'occurrences': sheet['node_count'],
            'concepts': len(sheet_concepts),
            'mapped_concepts': len(mapped),
            'unmapped_concepts': len(sheet_concepts) - len(mapped),
            'coverage_ratio': round(len(mapped) / len(sheet_concepts), 3) if sheet_concepts else 0.0,
        })

    report = {
        'schema_version': '1.0',
        'artifact': 'gap_analysis',
        'status': 'draft_pending_author_review',
        'generator': 'scripts/build_gap_analysis.py',
        'policy': {
            'no_fabricated_coverage': (
                'Покрытие со статусом verified подтверждено дословным якорем в файле урока. '
                'Покрытие со статусом proposed не подтверждено и не выдаётся за существующее.'
            ),
            'evidence_required': 'Каждая строка покрытия и каждый пробел несут ссылку на источник.',
        },
        'totals': {
            'occurrences': registry['counts']['occurrence_count'],
            'concepts': registry['counts']['concept_count'],
            'mapped_concepts': mapping['counts']['mapped_concepts'],
            'uncovered_concepts': mapping['counts']['uncovered_concepts'],
            'coverage_ratio': round(
                mapping['counts']['mapped_concepts'] / mapping['counts']['total_concepts'], 3),
            'verified_entries': mapping['counts']['entries_verified'],
            'proposed_entries': mapping['counts']['entries_proposed'],
            'proposed_only_concepts': len(proposed_only),
            'prerequisite_edges': prereq['counts']['edge_count'],
            'audit_findings': audit['counts']['findings'],
            'audit_open_findings': audit['counts']['open_findings'],
        },
        'coverage_by_lesson': sorted(
            by_lesson.values(),
            key=lambda r: (r['status'] != 'verified', r['lesson_id'])),
        'coverage_by_sheet': sheet_rows,
        'proposed_only_concepts': proposed_only,
        'gaps': gaps,
        'uncertain_concepts': uncertain_concepts,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    render_markdown(report, mapping, audit, occurrences)
    print('WROTE %s and %s: gaps=%d coverage=%.1f%%'
          % (OUT, MD, len(gaps), report['totals']['coverage_ratio'] * 100))


def render_markdown(report, mapping, audit, occurrences):
    """Render the human-readable report from the computed data."""
    t = report['totals']
    L = []
    L.append('# Анализ покрытия и пробелов')
    L.append('')
    L.append('> Сгенерировано `scripts/build_gap_analysis.py` из артефактов в `ontology/`.')
    L.append('> Числа в этом файле вычислены, а не вписаны вручную.')
    L.append('> Статус набора: **draft_pending_author_review**.')
    L.append('')
    L.append('## 1. Сводка')
    L.append('')
    L.append('| Показатель | Значение |')
    L.append('|---|---:|')
    L.append('| Рукописных вхождений (occurrences) | %d |' % t['occurrences'])
    L.append('| Канонических понятий (concepts) | %d |' % t['concepts'])
    L.append('| Понятий, связанных с уроками | %d |' % t['mapped_concepts'])
    L.append('| Понятий без покрытия уроками | %d |' % t['uncovered_concepts'])
    L.append('| Доля покрытия | %.1f%% |' % (t['coverage_ratio'] * 100))
    L.append('| Подтверждённых связей с уроками (verified) | %d |' % t['verified_entries'])
    L.append('| Предложенных связей с уроками (proposed) | %d |' % t['proposed_entries'])
    L.append('| Понятий, покрытых только предложением | %d |' % t['proposed_only_concepts'])
    L.append('| Рёбер в DAG предпосылок | %d |' % t['prerequisite_edges'])
    L.append('| Находок аудита транскрипции | %d |' % t['audit_findings'])
    L.append('| Из них открытых | %d |' % t['audit_open_findings'])
    L.append('')
    L.append('## 2. Покрытие по листам рукописи')
    L.append('')
    L.append('| Лист | Тема | Фото | Вхождений | Понятий | Покрыто | Не покрыто | Доля |')
    L.append('|---|---|---|---:|---:|---:|---:|---:|')
    for row in report['coverage_by_sheet']:
        L.append('| %s | %s | `%s` | %d | %d | %d | %d | %.0f%% |' % (
            row['sheet'], row['title'], row['source_image'], row['occurrences'],
            row['concepts'], row['mapped_concepts'], row['unmapped_concepts'],
            row['coverage_ratio'] * 100))
    L.append('')
    L.append('## 3. Покрытие по урокам')
    L.append('')
    L.append('### 3.1. Существующие уроки — покрытие подтверждено якорем в файле')
    L.append('')
    L.append('| Урок | Файл | Введено | Отработано | Проверено |')
    L.append('|---|---|---:|---:|---:|')
    for row in report['coverage_by_lesson']:
        if row['status'] != 'verified':
            continue
        L.append('| %s | `%s` | %d | %d | %d |' % (
            row['lesson_id'], row['lesson_file'],
            len(row['introduced_in']), len(row['practiced_in']), len(row['assessed_in'])))
    L.append('')
    L.append('### 3.2. Планируемые уроки — покрытие предложено, не подтверждено')
    L.append('')
    L.append('| Планируемый урок | Содержание плана | Введено | Отработано | Проверено |')
    L.append('|---|---|---:|---:|---:|')
    for row in report['coverage_by_lesson']:
        if row['status'] != 'proposed':
            continue
        plan = mapping['planned_only_lessons'].get(row['lesson_id'], '—')
        L.append('| %s | %s | %d | %d | %d |' % (
            row['lesson_id'], plan,
            len(row['introduced_in']), len(row['practiced_in']), len(row['assessed_in'])))
    L.append('')
    L.append('## 4. Пробелы')
    L.append('')
    L.append('Пробел — это каноническое понятие, для которого **нет ни одного** урока,')
    L.append('который его покрывает. Ничего не выдумано: отсутствие покрытия и есть результат.')
    L.append('')
    L.append('| Понятие | Подпись | Тип | Вхождения | Листы | Серьёзность |')
    L.append('|---|---|---|---|---|---|')
    for gap in report['gaps']:
        L.append('| `%s` | %s | %s | %s | %s | %s |' % (
            gap['concept_id'], gap['label'], gap['kind'],
            ', '.join('`%s`' % o for o in gap['occurrence_ids']),
            ', '.join(gap['source_images']), gap['severity']))
    L.append('')
    L.append('**Всего пробелов: %d.**' % len(report['gaps']))
    L.append('')
    L.append('## 5. Неопределённость чтения, влияющая на понятия')
    L.append('')
    L.append('| Понятие | Открытые находки аудита |')
    L.append('|---|---|')
    for concept_id in report['uncertain_concepts']:
        rows = [f for f in audit['findings']
                if f['status'] == 'open'
                and occurrences.get(f['occurrence_id'], {}).get('concept_id') == concept_id]
        cats = ', '.join(sorted({f['category'] for f in rows}))
        L.append('| `%s` | %s |' % (concept_id, cats))
    L.append('')
    L.append('## 6. Открытые вопросы к автору фотографий')
    L.append('')
    for q in audit['explicit_questions']:
        L.append('- **%s** — %s' % (q['id'], q['question']))
        L.append('  - Источник: %s' % q['source'])
    L.append('')
    L.append('## 7. Что этот отчёт не утверждает')
    L.append('')
    L.append('- Он не утверждает, что покрытие уроками **достаточно** — только то, что оно есть и чем подтверждено.')
    L.append('- Он не превращает `proposed` в `verified`: без написанного урока подтверждать нечего.')
    L.append('- Он не утверждает, что чтение рукописи верно: спорные места вынесены в раздел 5 и в аудит.')
    L.append('- Он не оценивает учебную нагрузку и не измеряет время освоения.')
    L.append('')
    # Exactly one trailing newline: 'git diff --check' flags a blank line at EOF.
    MD.write_text('\n'.join(L).rstrip('\n') + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
