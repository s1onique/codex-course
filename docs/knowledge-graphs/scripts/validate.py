#!/usr/bin/env python3
"""Structural validation of digitized course knowledge graphs (stdlib only)."""
import json
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
G = ROOT / 'graphs'
read = lambda name: json.loads((G / name).read_text(encoding='utf-8'))
sheets = [read(f'kg{i:02}.json') for i in (1, 2, 3)]
combined = read('combined.json')
alignments = read('alignments.json')['alignments']

ids = [node['id'] for sheet in sheets for node in sheet['nodes']]
assert len(ids) == len(set(ids)), 'Duplicate node ID'
full_ids = set(ids)
assert len(combined['nodes']) == len(ids)
assert {node['id'] for node in combined['nodes']} == full_ids
for sheet in sheets:
    local_ids = {node['id'] for node in sheet['nodes']}
    assert all(node['provenance']['sheet'] == sheet['graph_id'] for node in sheet['nodes'])
    assert all(edge['from'] in local_ids and edge['to'] in local_ids for edge in sheet['edges'])
    assert all(edge['origin'] in {'handwriting', 'pedagogical_inference'} for edge in sheet['edges'])
    for node in sheet['nodes']:
        assert node['provenance']['evidence'] == 'handwriting'
        assert node['provenance']['confidence'] in {'high', 'medium', 'low'}
        assert node['id'].startswith(sheet['graph_id'].lower() + '_')
    assert (ROOT / sheet['source_image']).is_file(), sheet['source_image']
for e in combined['edges']:
    assert e['from'] in full_ids and e['to'] in full_ids
    assert e['origin'] in {'handwriting', 'pedagogical_inference'}
    if e['relation'] in ('same_concept_candidate', 'overlapping_concepts'):
        assert e['origin'] == 'pedagogical_inference'
edge_keys = [(e['from'], e['to'], e['relation'], e['origin']) for e in combined['edges']]
assert len(edge_keys) == len(set(edge_keys)), 'Duplicate relationship'
assert all(e['origin'] == 'pedagogical_inference' or e['from'].split('_')[0] == e['to'].split('_')[0] for e in combined['edges']), 'Inferred cross-sheet handwritten arrow'
assert len(combined['edges']) >= sum(len(g['edges']) for g in sheets)
assert all(e in combined['edges'] for g in sheets for e in g['edges'])
assert all(e in combined['edges'] for e in alignments)
assert not any(e['relation'] == 'requires' for e in combined['edges']), 'No curriculum prerequisite DAG authorized yet'
counts = Counter(e['origin'] for e in combined['edges'])
print('PASS: 3 sheets; nodes=%d; edges=%d; handwritten=%d; inferred=%d; alignment_candidates=%d'
      % (len(ids), len(combined['edges']), counts['handwriting'], counts['pedagogical_inference'], len(alignments)))
