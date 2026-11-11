#!/usr/bin/env python3
"""Deterministic structural tests for the curriculum ontology.

Stdlib only (unittest + json + pathlib). No network, no services, no graph DB.

Run:
    python -m unittest discover -s docs/knowledge-graphs/tests -v
or:
    python docs/knowledge-graphs/tests/test_ontology.py

The five mandated invariants each have their own TestCase:

    IdentityUniqueness   - concept ids and occurrence ids are unique
    ValidReferences      - every cross-artifact reference resolves
    DagAcyclicity        - the prerequisite graph has no cycle
    NoProvenanceLoss     - every handwritten occurrence survives, unchanged
    NoFabricatedCoverage - 'verified' coverage is backed by a real lesson file
"""
import json
import subprocess
import sys
import unittest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
KG_ROOT = TESTS_DIR.parent
COURSE_ROOT = KG_ROOT.parents[1]
G = KG_ROOT / 'graphs'
ONT = KG_ROOT / 'ontology'


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def detect_cycle(edges):
    """Return a cycle as a list of ids, or None when the graph is acyclic."""
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


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sheets = [load(G / f'kg{i:02}.json') for i in (1, 2, 3)]
        cls.registry = load(ONT / 'concepts.json')
        cls.prereq = load(ONT / 'prerequisites.json')
        cls.mapping = load(ONT / 'lesson-mapping.json')
        cls.audit = load(ONT / 'audit.json')
        cls.gaps = load(ONT / 'gap-analysis.json')
        cls.handwritten = {
            node['id']: (sheet, node)
            for sheet in cls.sheets
            for node in sheet['nodes']
        }
        cls.concepts = {c['concept_id']: c for c in cls.registry['concepts']}
        cls.occurrences = {o['occurrence_id']: o for o in cls.registry['occurrences']}
        cls.course_only = {c['id'] for c in cls.prereq['course_only_concepts']}


class IdentityUniqueness(Base):
    """Invariant 1: identity uniqueness."""

    def test_concept_ids_are_unique(self):
        ids = [c['concept_id'] for c in self.registry['concepts']]
        self.assertEqual(len(ids), len(set(ids)), 'duplicate concept_id in registry')

    def test_occurrence_ids_are_unique(self):
        ids = [o['occurrence_id'] for o in self.registry['occurrences']]
        self.assertEqual(len(ids), len(set(ids)), 'duplicate occurrence_id in registry')

    def test_handwritten_ids_are_unique(self):
        ids = [n['id'] for s in self.sheets for n in s['nodes']]
        self.assertEqual(len(ids), len(set(ids)), 'duplicate node id in source sheets')

    def test_concept_ids_are_stable_across_rebuilds(self):
        """The registry is reproducible: rebuilding yields byte-identical output."""
        before = (ONT / 'concepts.json').read_bytes()
        result = subprocess.run(
            [sys.executable, str(KG_ROOT / 'scripts' / 'build_registry.py')],
            capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        after = (ONT / 'concepts.json').read_bytes()
        self.assertEqual(before, after, 'registry build is not deterministic')

    def test_concept_id_namespace_is_explicit(self):
        for concept_id in self.concepts:
            self.assertTrue(
                concept_id.startswith('concept_'),
                'unexpected concept id namespace: %s' % concept_id)


class ValidReferences(Base):
    """Invariant 2: valid references."""

    def test_concept_occurrences_resolve(self):
        for concept in self.registry['concepts']:
            for occ in concept['occurrence_ids']:
                self.assertIn(occ, self.handwritten,
                              'concept %s references unknown occurrence %s'
                              % (concept['concept_id'], occ))

    def test_occurrence_concept_backlink_resolves(self):
        for occ_id, occurrence in self.occurrences.items():
            self.assertIn(occurrence['concept_id'], self.concepts,
                          'occurrence %s points at unknown concept' % occ_id)
            self.assertIn(
                occ_id, self.concepts[occurrence['concept_id']]['occurrence_ids'],
                'occurrence %s is not listed by its concept' % occ_id)

    def test_prerequisite_edges_resolve(self):
        resolvable = set(self.concepts) | self.course_only
        for edge in self.prereq['edges']:
            self.assertIn(edge['from'], resolvable)
            self.assertIn(edge['to'], resolvable)

    def test_prerequisite_edges_have_rationale_and_trace(self):
        for edge in self.prereq['edges']:
            self.assertTrue(edge.get('rationale'),
                            'edge %s has no rationale' % edge.get('edge_id'))
            self.assertTrue(edge.get('traced_to'),
                            'edge %s has no trace' % edge.get('edge_id'))

    def test_prerequisite_edges_are_not_handwriting(self):
        """Prerequisites are proposals; they must never claim handwritten origin."""
        for edge in self.prereq['edges']:
            self.assertNotEqual(
                edge.get('origin'), 'handwriting',
                'prerequisite edge claims handwritten origin: %s' % edge.get('edge_id'))
            self.assertEqual(edge.get('origin'), 'pedagogical_proposal')

    def test_lesson_mapping_concepts_resolve(self):
        resolvable = set(self.concepts) | self.course_only | {
            c['id'] for c in self.mapping['course_only_concepts']}
        for record in self.mapping['mapping']:
            self.assertIn(record['concept_id'], resolvable)

    def test_audit_findings_resolve(self):
        for finding in self.audit['findings']:
            self.assertIn(finding['occurrence_id'], self.handwritten)
            self.assertTrue(finding.get('evidence'),
                            'finding %s has no evidence' % finding['finding_id'])

    def test_gap_entries_resolve(self):
        for gap in self.gaps['gaps']:
            self.assertIn(gap['concept_id'], self.concepts)
            for occ in gap['occurrence_ids']:
                self.assertIn(occ, self.handwritten)

    def test_out_of_dag_entries_resolve(self):
        for entry in self.prereq['out_of_dag']:
            self.assertIn(entry['concept_id'], self.concepts)


class DagAcyclicity(Base):
    """Invariant 3: the prerequisite graph is a DAG."""

    def test_prerequisite_graph_is_acyclic(self):
        cycle = detect_cycle(self.prereq['edges'])
        self.assertIsNone(cycle, 'cycle in prerequisite DAG: %s' % cycle)

    def test_no_self_loops(self):
        for edge in self.prereq['edges']:
            self.assertNotEqual(edge['from'], edge['to'],
                                'self-loop on %s' % edge['from'])

    def test_no_duplicate_edges(self):
        keys = [(e['from'], e['to'], e['relation']) for e in self.prereq['edges']]
        self.assertEqual(len(keys), len(set(keys)), 'duplicate prerequisite edge')

    def test_relation_is_typed(self):
        allowed = set(self.prereq['policy']['edge_types'])
        for edge in self.prereq['edges']:
            self.assertIn(edge['relation'], allowed,
                          'unknown prerequisite relation: %s' % edge['relation'])

    def test_topological_order_exists(self):
        """An explicit topological order proves acyclicity independently."""
        # The DAG is the SUBGRAPH induced by the edges: concepts that appear
        # in no edge are simply not part of it.
        nodes = set()
        adjacency = {}
        indegree = {}
        for edge in self.prereq['edges']:
            for end in ('from', 'to'):
                nodes.add(edge[end])
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
        self.assertEqual(visited, len(nodes), 'prerequisite graph is not a DAG')

    def test_dag_nodes_are_declared_concepts(self):
        """Every vertex of the DAG must be a known concept or course concept."""
        resolvable = set(self.concepts) | self.course_only
        for edge in self.prereq['edges']:
            self.assertIn(edge['from'], resolvable)
            self.assertIn(edge['to'], resolvable)


class NoProvenanceLoss(Base):
    """Invariant 4: no provenance loss."""

    def test_every_handwritten_occurrence_survives(self):
        self.assertEqual(set(self.occurrences), set(self.handwritten),
                         'registry lost or invented occurrences')

    def test_no_occurrence_is_shared_between_concepts(self):
        seen = {}
        for concept in self.registry['concepts']:
            for occ in concept['occurrence_ids']:
                self.assertNotIn(occ, seen,
                                 'occurrence %s belongs to two concepts' % occ)
                seen[occ] = concept['concept_id']

    def test_provenance_fields_are_unchanged(self):
        for occ_id, (sheet, node) in self.handwritten.items():
            record = self.occurrences[occ_id]
            self.assertEqual(record['provenance'], node['provenance'],
                             'provenance changed for %s' % occ_id)
            self.assertEqual(record['label'], node['label'],
                             'label changed for %s' % occ_id)
            self.assertEqual(record['sheet'], sheet['graph_id'],
                             'sheet changed for %s' % occ_id)
            self.assertEqual(record['kind'], node['kind'],
                             'kind changed for %s' % occ_id)

    def test_raw_labels_are_preserved(self):
        for occ_id, (sheet, node) in self.handwritten.items():
            if 'raw_label' in node:
                self.assertEqual(self.occurrences[occ_id].get('raw_label'),
                                 node['raw_label'],
                                 'raw_label lost for %s' % occ_id)

    def test_reviewer_notes_are_preserved(self):
        for occ_id, (sheet, node) in self.handwritten.items():
            if 'review_note' in node:
                self.assertEqual(self.occurrences[occ_id].get('review_note'),
                                 node['review_note'],
                                 'review_note lost for %s' % occ_id)

    def test_source_images_still_exist(self):
        for sheet in self.registry['sources']['sheets']:
            self.assertTrue((KG_ROOT / sheet['source_image']).is_file(),
                            'source image missing: %s' % sheet['source_image'])
            if sheet.get('source_original'):
                self.assertTrue((KG_ROOT / sheet['source_original']).is_file(),
                                'original image missing: %s' % sheet['source_original'])

    def test_declared_merges_are_documented(self):
        """A merge of two occurrences must carry a rationale and a confidence."""
        for concept in self.registry['concepts']:
            if len(concept['occurrence_ids']) > 1:
                self.assertNotEqual(concept['merge_kind'], 'single_occurrence',
                                    'multi-occurrence concept without declared merge: %s'
                                    % concept['concept_id'])
                self.assertTrue(concept['merge_rationale'],
                                'merge without rationale: %s' % concept['concept_id'])
                self.assertIn(concept['merge_confidence'],
                              ('high', 'medium', 'low'))

    def test_ambiguous_pairs_stay_separate(self):
        """The pairs declared as NOT merged must occupy distinct concepts."""
        for pair in self.registry['declared_non_merges']:
            concept_ids = {self.occurrences[o]['concept_id']
                           for o in pair['occurrence_ids'] if o in self.occurrences}
            self.assertGreater(
                len(concept_ids), 1,
                'declared non-merge was actually merged: %s' % pair['occurrence_ids'])


class NoFabricatedCoverage(Base):
    """Invariant 5: no fabricated lesson coverage."""

    def test_verified_coverage_names_an_existing_lesson_file(self):
        existing = self.mapping['existing_lessons']
        for record in self.mapping['mapping']:
            for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
                for entry in record[relation]:
                    if entry['status'] != 'verified':
                        continue
                    lesson = entry['lesson_id']
                    self.assertIn(lesson, existing,
                                  'verified coverage names unknown lesson %s' % lesson)
                    path = COURSE_ROOT / existing[lesson]
                    self.assertTrue(path.is_file(),
                                    'verified coverage names a missing file: %s' % path)

    def test_verified_coverage_has_a_real_evidence_anchor(self):
        """The anchor must literally occur in the lesson file."""
        existing = self.mapping['existing_lessons']
        checked = 0
        for record in self.mapping['mapping']:
            for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
                for entry in record[relation]:
                    if entry['status'] != 'verified':
                        continue
                    path = COURSE_ROOT / existing[entry['lesson_id']]
                    text = path.read_text(encoding='utf-8')
                    self.assertIn(entry['evidence_anchor'], text,
                                  'anchor not found in %s for %s'
                                  % (entry['lesson_id'], record['concept_id']))
                    checked += 1
        self.assertGreater(checked, 0, 'no verified coverage to check')

    def test_proposed_coverage_claims_nothing(self):
        """A proposal has no file and no anchor: nothing to verify, nothing claimed."""
        for record in self.mapping['mapping']:
            for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
                for entry in record[relation]:
                    if entry['status'] != 'proposed':
                        continue
                    self.assertIsNone(entry['evidence_anchor'],
                                      'proposed coverage carries an anchor: %s'
                                      % record['concept_id'])
                    self.assertIsNone(entry['lesson_file'],
                                      'proposed coverage claims a file: %s'
                                      % record['concept_id'])

    def test_proposed_lessons_are_declared_as_planned(self):
        planned = set(self.mapping['planned_only_lessons'])
        existing = set(self.mapping['existing_lessons'])
        for record in self.mapping['mapping']:
            for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
                for entry in record[relation]:
                    if entry['status'] != 'proposed':
                        continue
                    self.assertTrue(
                        entry['lesson_id'] in planned or entry['lesson_id'] in existing,
                        'proposed coverage names an undeclared lesson: %s'
                        % entry['lesson_id'])

    def test_planned_lessons_have_no_file(self):
        """A 'planned only' lesson id must NOT correspond to an existing file."""
        existing = self.mapping['existing_lessons']
        for lesson_id in self.mapping['planned_only_lessons']:
            self.assertNotIn(lesson_id, existing,
                             'planned-only lesson is actually an existing lesson: %s'
                             % lesson_id)
            if lesson_id.startswith('LESSON-') and lesson_id.count('-') == 1:
                candidate = COURSE_ROOT / (lesson_id + '.md')
                self.assertFalse(candidate.exists(),
                                 'planned-only lesson has a file: %s' % candidate)

    def test_statuses_are_only_verified_or_proposed(self):
        for record in self.mapping['mapping']:
            for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
                for entry in record[relation]:
                    self.assertIn(entry['status'], ('verified', 'proposed'))

    def test_gap_list_is_exactly_the_uncovered_set(self):
        mapped = {r['concept_id'] for r in self.mapping['mapping']}
        uncovered = set(self.mapping['uncovered_concepts'])
        gap_ids = {g['concept_id'] for g in self.gaps['gaps']}
        self.assertEqual(gap_ids, uncovered,
                         'gap list and uncovered list disagree')
        self.assertFalse(mapped & uncovered,
                         'a concept is reported both as covered and as a gap')

    def test_every_gap_carries_its_evidence(self):
        for gap in self.gaps['gaps']:
            self.assertTrue(gap['occurrence_ids'], 'gap without occurrences')
            self.assertTrue(gap['source_images'], 'gap without a source sheet')
            self.assertTrue(gap['note'], 'gap without a note')

    def test_verified_and_proposed_are_counted_separately(self):
        counts = self.mapping['counts']
        verified = proposed = 0
        for record in self.mapping['mapping']:
            for relation in ('introduced_in', 'practiced_in', 'assessed_in'):
                for entry in record[relation]:
                    if entry['status'] == 'verified':
                        verified += 1
                    else:
                        proposed += 1
        self.assertEqual(counts['entries_verified'], verified)
        self.assertEqual(counts['entries_proposed'], proposed)

    def test_validators_run_clean(self):
        """Both validators must exit 0 on the committed artifacts."""
        for script in ('validate.py', 'validate_ontology.py'):
            result = subprocess.run(
                [sys.executable, str(KG_ROOT / 'scripts' / script)],
                capture_output=True, text=True)
            self.assertEqual(result.returncode, 0,
                             '%s failed:\n%s' % (script, result.stdout + result.stderr))
            self.assertIn('PASS', result.stdout,
                          '%s did not report PASS' % script)


if __name__ == '__main__':
    unittest.main(verbosity=2)
