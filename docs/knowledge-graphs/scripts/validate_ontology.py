#!/usr/bin/env python3
"""Structural validation of the curriculum ontology (stdlib only).

This is the companion to scripts/validate.py, which validates the imported
handwritten graphs. It validates the DERIVED ontology:

  * identity uniqueness of concept ids and occurrence ids
  * every reference resolves (concept -> occurrence, edge -> concept,
    mapping -> concept/lesson, gap -> concept)
  * the prerequisite graph is acyclic
  * no provenance loss: every handwritten occurrence survives into the registry
  * no fabricated lesson coverage: a 'verified' entry must name an existing
    lesson file and its evidence anchor must be present in that file
  * the handwritten source files and images are still present

Run:  python scripts/validate_ontology.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT.parents[1]
G = ROOT / 'graphs'
ONT = ROOT / 'ontology'

failures = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        failures.append(message)


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def detect_cycle(edges):
    graph = {}
    for edge in edges:
        graph.setdefault(edge['from'], []).append(edge['to'])
    WHITE, GREY, BLACK = 0, 1, 2
    color = {}

    def visit(node, stack):
        color[node] = GREY
        stack.append(node)
        for nxt in sorted(graph.get(node, [])):
            if color.get(nxt, WHITE) == GREY:
                return stack[stack.index(nxt):] + [nxt]
            if color.get(nxt, WHITE) == WHITE:
                found = visit(nxt, stack)
                if found:
                    return found
        stack.pop()
        color[node] = BLACK
        return None

    for node in sorted(graph):
        if color.get(node, WHITE) == WHITE:
            found = visit(node, [])
            if found:
                return found
    return None


def main():
    sheets = [load(G / f'kg{i:02}.json') for i in (1, 2, 3)]
    registry = load(ONT / 'concepts.json')
    prereq = load(ONT / 'prerequisites.json')
    mapping = load(ONT / 'lesson-mapping.json')
    audit = load(ONT / 'audit.json')
    gaps = load(ONT / 'gap-analysis.json')

    handwritten_ids = {n['id'] for s in sheets for n in s['nodes']}
    concepts = registry['concepts']
    concept_ids = [c['concept_id'] for c in concepts]
    concept_set = set(concept_ids)

    # --- 1. identity uniqueness -----------------------------------------
    check(len(concept_ids) == len(concept_set), 'duplicate concept_id')
    occ_ids = [o['occurrence_id'] for o in registry['occurrences']]
    check(len(occ_ids) == len(set(occ_ids)), 'duplicate occurrence_id in registry')
    check(len(occ_ids) == len(handwritten_ids), 'registry occurrence count differs from handwriting')

    # --- 2. no provenance loss ------------------------------------------
    check(set(occ_ids) == handwritten_ids, 'registry lost or invented occurrences')
    registry_occ = {o['occurrence_id']: o for o in registry['occurrences']}
    for sheet in sheets:
        for node in sheet['nodes']:
            rec = registry_occ.get(node['id'])
            check(rec is not None, 'occurrence missing from registry: %s' % node['id'])
            if rec is None:
                continue
            check(rec['provenance'] == node['provenance'],
                  'provenance changed for %s' % node['id'])
            check(rec['label'] == node['label'], 'label changed for %s' % node['id'])
            if 'raw_label' in node:
                check(rec.get('raw_label') == node['raw_label'],
                      'raw_label lost for %s' % node['id'])
            if 'review_note' in node:
                check(rec.get('review_note') == node['review_note'],
                      'review_note lost for %s' % node['id'])

    # --- 3. concept -> occurrence linkage --------------------------------
    linked = set()
    for concept in concepts:
        check(concept['occurrence_ids'], 'concept with no occurrences: %s' % concept['concept_id'])
        for occ in concept['occurrence_ids']:
            check(occ in handwritten_ids,
                  'concept %s references unknown occurrence %s' % (concept['concept_id'], occ))
            check(occ not in linked, 'occurrence %s linked to more than one concept' % occ)
            linked.add(occ)
            if occ in registry_occ:
                check(registry_occ[occ]['concept_id'] == concept['concept_id'],
                      'occurrence %s points at a different concept' % occ)
    check(linked == handwritten_ids, 'some occurrences are not reachable from any concept')

    # --- 4. valid references ---------------------------------------------
    course_only = {c['id'] for c in prereq['course_only_concepts']}
    resolvable = concept_set | course_only
    for edge in prereq['edges']:
        check(edge['from'] in resolvable, 'prerequisite edge from unknown concept: %s' % edge['from'])
        check(edge['to'] in resolvable, 'prerequisite edge to unknown concept: %s' % edge['to'])
        check(edge['origin'] == 'pedagogical_proposal',
              'prerequisite edge must not claim handwriting origin: %s' % edge.get('edge_id'))
        check(bool(edge.get('rationale')), 'prerequisite edge without rationale')
        check(bool(edge.get('traced_to')), 'prerequisite edge without trace')
    for entry in prereq['out_of_dag']:
        check(entry['concept_id'] in concept_set,
              'out_of_dag references unknown concept: %s' % entry['concept_id'])

    # --- 5. DAG acyclicity ----------------------------------------------
    cycle = detect_cycle(prereq['edges'])
    check(cycle is None, 'cycle in prerequisite DAG: %s' % cycle)

    # A cycle may also be reported through an explicit topological sort.
    indegree = {}
    adjacency = {}
    for edge in prereq['edges']:
        for end in ('from', 'to'):
            indegree.setdefault(edge[end], 0)
        adjacency.setdefault(edge['from'], []).append(edge['to'])
        indegree[edge['to']] += 1
    queue = sorted(c for c, d in indegree.items() if d == 0)
    visited = 0
    while queue:
        node = queue.pop(0)
        visited += 1
        for nxt in adjacency.get(node, []):
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    check(visited == len(indegree), 'prerequisite graph is not a DAG')

    # --- 6. no fabricated lesson coverage --------------------------------
    existing = mapping['existing_lessons']
    planned = set(mapping['planned_only_lessons'])
    mapping_resolvable = resolvable | {c['id'] for c in mapping['course_only_concepts']}
    for record in mapping['mapping']:
        check(record['concept_id'] in mapping_resolvable,
              'lesson mapping references unknown concept: %s' % record['concept_id'])
        for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
            for entry in record[relation]:
                check(entry['status'] in ('verified', 'proposed'),
                      'unknown coverage status: %s' % entry['status'])
                if entry['status'] == 'verified':
                    lesson = entry['lesson_id']
                    check(lesson in existing,
                          'verified coverage names a non-existent lesson: %s' % lesson)
                    if lesson not in existing:
                        continue
                    check(entry['lesson_file'] == existing.get(lesson),
                          'verified coverage has wrong lesson file: %s' % lesson)
                    path = COURSE / existing[lesson]
                    check(path.is_file(), 'lesson file missing: %s' % path)
                    if path.is_file() and entry.get('evidence_anchor'):
                        text = path.read_text(encoding='utf-8')
                        check(entry['evidence_anchor'] in text,
                              'evidence anchor not found in %s for %s'
                              % (existing[lesson], record['concept_id']))
                else:
                    check(entry['lesson_id'] in planned or entry['lesson_id'] in existing,
                          'proposed coverage names an unknown lesson: %s' % entry['lesson_id'])
                    check(entry.get('evidence_anchor') is None,
                          'proposed coverage must not carry an evidence anchor: %s'
                          % record['concept_id'])
                    check(entry.get('lesson_file') is None,
                          'proposed coverage must not claim a lesson file: %s'
                          % record['concept_id'])

    # --- 7. mapping completeness vs gap analysis -------------------------
    # The mapping may also carry course-only concepts (namespace course:*),
    # which are NOT part of the handwritten concept set. The partition check
    # therefore applies to the handwritten concepts only.
    mapped = {r['concept_id'] for r in mapping['mapping']}
    uncovered = set(mapping['uncovered_concepts'])
    check((mapped & concept_set) | uncovered == concept_set,
          'mapping and uncovered list do not partition the concept set')
    check(not (mapped & uncovered), 'a concept is both mapped and uncovered')
    check({g['concept_id'] for g in gaps['gaps']} == uncovered,
          'gap analysis does not match the uncovered concept list')
    mapping_course_only = {c['id'] for c in mapping['course_only_concepts']}
    check(mapped - concept_set <= mapping_course_only,
          'mapping contains a concept from an unknown namespace')

    # --- 8. audit references ---------------------------------------------
    for finding in audit['findings']:
        check(finding['occurrence_id'] in handwritten_ids,
              'audit finding references unknown occurrence: %s' % finding['occurrence_id'])
        check(bool(finding.get('evidence')), 'audit finding without evidence')
    for q in audit['explicit_questions']:
        for occ in ([q['occurrence_id']] if 'occurrence_id' in q else q.get('occurrence_ids', [])):
            check(occ in handwritten_ids,
                  'open question references unknown occurrence: %s' % occ)

    # --- 9. source images still present ----------------------------------
    for sheet in registry['sources']['sheets']:
        check((ROOT / sheet['source_image']).is_file(),
              'source image missing: %s' % sheet['source_image'])
        if sheet.get('source_original'):
            check((ROOT / sheet['source_original']).is_file(),
                  'original source image missing: %s' % sheet['source_original'])

    if failures:
        print('FAIL: %d of %d checks failed' % (len(failures), checks))
        for f in failures:
            print('  - %s' % f)
        return 1
    print('PASS: ontology validation; checks=%d; concepts=%d; occurrences=%d; '
          'prereq_edges=%d; verified=%d; proposed=%d; gaps=%d; audit_findings=%d'
          % (checks, len(concepts), len(occ_ids), len(prereq['edges']),
             mapping['counts']['entries_verified'], mapping['counts']['entries_proposed'],
             len(gaps['gaps']), len(audit['findings'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
