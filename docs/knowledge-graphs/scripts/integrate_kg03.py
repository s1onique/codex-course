#!/usr/bin/env python3
"""Integrate third photographed map into KG01/KG02 export, preserving provenance.

Uses Python standard library except Pillow for the human-friendly rotated source photo.
The existing kg01/kg02 JSON files are the source of truth for earlier sheets.
"""
from __future__ import annotations
import json
import re
import shutil
import zipfile
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
GRAPHS = BASE / 'graphs'
ORIGINAL = BASE / 'sources' / 'kg03-application-original.jpg'


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


class HandGraph:
    def __init__(self, graph_id: str, title: str, source_image: str):
        self.graph_id = graph_id
        self.title = title
        self.source_image = source_image
        self.nodes: list[dict] = []
        self.edges: list[dict] = []
        self.nodes_by_key: dict[str, str] = {}
        self.node('root', 'Приложение', 'root')

    def node(self, key: str, label: str, kind: str = 'concept', confidence: str = 'high',
             raw: str | None = None, note: str | None = None) -> str:
        assert re.fullmatch('[a-z0-9_]+', key)
        assert key not in self.nodes_by_key, key
        n_id = f'kg03_{key}'
        item = {'id': n_id, 'label': label, 'kind': kind,
                'provenance': {'sheet': 'KG03', 'evidence': 'handwriting', 'confidence': confidence}}
        if raw is not None and raw != label:
            item['raw_label'] = raw
        if note:
            item['review_note'] = note
        self.nodes.append(item)
        self.nodes_by_key[key] = n_id
        return n_id

    def edge(self, source_key: str, target_key: str, relation: str = 'has_branch',
             origin: str = 'handwriting', note: str | None = None):
        src = self.nodes_by_key[source_key]
        dest = self.nodes_by_key[target_key]
        edge = {'from': src, 'to': dest, 'relation': relation, 'origin': origin,
                'confidence': 'high' if origin == 'handwriting' else 'medium'}
        if note:
            edge['note'] = note
        self.edges.append(edge)

    def branch(self, key: str, label: str, kind='topic', **kw):
        self.node(key, label, kind, **kw)
        self.edge('root', key)

    def child(self, parent: str, key: str, label: str, kind='concept', **kw):
        self.node(key, label, kind, **kw)
        self.edge(parent, key)

    def annotation(self, parent: str, key: str, label: str, kind='example', **kw):
        """Text is physically adjacent without a definite drawn arrow."""
        self.node(key, label, kind, **kw)
        self.edge(parent, key, 'annotates', 'pedagogical_inference',
                  'Текст расположен рядом с веткой, но отдельной стрелки на фотографии не видно.')

    def data(self):
        return {'schema_version': '1.0', 'graph_id': self.graph_id, 'title': self.title,
                'language': 'ru', 'status': 'draft_three_sheets_transcribed',
                'source_image': self.source_image,
                'source_original': 'sources/kg03-application-original.jpg',
                'nodes': self.nodes, 'edges': self.edges}


g = HandGraph('KG03', 'Приложение', 'sources/kg03-application.jpg')
g.branch('diagnostics', 'Диагностика')
g.child('diagnostics', 'logging', 'Логирование')
g.child('diagnostics', 'profiling', 'Профилирование')
g.child('diagnostics', 'debugging', 'Отладка')
g.annotation('logging', 'loki', 'Loki')
g.annotation('logging', 'kibana', 'Kibana', raw='Kibana (elk)', note='ELK — обозначение стека; Kibana — отдельный компонент.')
g.annotation('logging', 'elasticsearch', 'Elasticsearch')
g.annotation('profiling', 'ebpf', 'eBPF')
g.annotation('profiling', 'flamegraphs', 'Flame graphs', raw='flameGraphs')

g.branch('recovery', 'Восстановление после сбоев')
g.child('recovery', 'fail_fast', 'Fail-fast / restart', raw='fail fast (restart)',
        note='Fail-fast и restart — разные механизмы; на листе сгруппированы, не доказана их эквивалентность.')
g.child('recovery', 'backoff', 'Exponential backoff', raw='exponential backoff')

g.branch('identity', 'Аутентификация и авторизация')
g.annotation('identity', 'keycloak', 'Keycloak')
g.annotation('identity', 'adfs', 'AD FS', raw='ADFS')
g.annotation('identity', 'credentials', 'Учётные данные', confidence='medium', raw='креды',
             note='Чтение «креды» вероятное; разговорное от credentials. Уточнить по автору.')

g.branch('security_events', 'События безопасности')
g.child('security_events', 'audit_logs', 'Аудит-логи', raw='аудит-логи')

g.branch('external_interaction', 'Взаимодействие с внешним миром')
g.child('external_interaction', 'synchronous', 'Синхронное')
g.child('external_interaction', 'asynchronous', 'Асинхронное')
g.annotation('asynchronous', 'rabbitmq', 'RabbitMQ', raw='rabbit')
g.annotation('asynchronous', 'kafka', 'Kafka')

g.branch('state_storage', 'Хранение состояния')
g.child('state_storage', 'files', 'В файлах')
g.child('state_storage', 'cache', 'В кэше (Redis)', raw='в кэше redis')
g.child('state_storage', 'rdbms', 'В реляционной СУБД (PostgreSQL, MySQL, MariaDB)',
        raw='в РСУБД Postgress, MySQL, MariaDB',
        note='На листе написано «Postgress» или сокращённое «Postgres»; нормализовано в PostgreSQL.')
g.child('state_storage', 'nosql', 'В NoSQL БД (MongoDB, Cassandra)',
        raw='в noSQL БД mongo DB, Cassandra')

# Copy the new readable image without modifying the original uploaded photo.
if ORIGINAL.exists():
    # Original photo is already included in the exported package.
    try:
        from PIL import Image
        Image.open(ORIGINAL).rotate(90, expand=True).save(BASE / 'sources' / 'kg03-application.jpg', quality=94)
    except ImportError:
        shutil.copyfile(ORIGINAL, BASE / 'sources' / 'kg03-application.jpg')
        print('Pillow unavailable: source image not rotated')

old = []
for gid in ('kg01', 'kg02'):
    p = GRAPHS / f'{gid}.json'
    obj = json.loads(p.read_text(encoding='utf-8'))
    obj['status'] = 'draft_three_sheets_transcribed'
    write_json(p, obj)
    old.append(obj)
new = g.data()
write_json(GRAPHS / 'kg03.json', new)

# Historic 9 cross-graph suggestions are retained verbatim and only extended.
previous_combined = json.loads((GRAPHS / 'combined.json').read_text(encoding='utf-8'))
old_links = [e for e in previous_combined['edges']
             if e['origin'] == 'pedagogical_inference'
             and e['from'].startswith(('kg01_', 'kg02_'))
             and e['to'].startswith(('kg01_', 'kg02_'))]
# Distinguish exact matching *branches* from partial similarities between examples.
links = [
    ('kg01_state_storage', 'kg03_state_storage', 'same_concept_candidate', 'Обе ветки означают хранение состояния приложения.'),
    ('kg01_files', 'kg03_files', 'same_concept_candidate', 'Совпадение способа хранения «в файлах».'),
    ('kg01_cache', 'kg03_cache', 'same_concept_candidate', 'Совпадение кэша Redis; режим хранения и гарантии не уточнены.'),
    ('kg01_rdbms', 'kg03_rdbms', 'overlapping_concepts', 'В KG03 дополнительно указана MariaDB; разные списки примеров.'),
    ('kg01_nosql', 'kg03_nosql', 'overlapping_concepts', 'В KG03 дополнительно Cassandra; разные списки примеров.'),
    ('kg01_how_test', 'kg03_diagnostics', 'related_concept', 'Тестирование и диагностика связаны, но не равнозначны.'),
    ('kg01_test_security', 'kg03_security_events', 'related_concept', 'Проверка безопасности и события безопасности — разные задачи.'),
    ('kg01_how_launch', 'kg03_recovery', 'related_concept', 'Перезапуск приложения при сбое связан с управлением жизненным циклом.'),
    ('kg01_where_run', 'kg03_recovery', 'related_concept', 'Организация среды исполнения влияет на механизмы восстановления.'),
    ('kg02_network', 'kg03_external_interaction', 'related_concept', 'Сетевые протоколы — часть внешних взаимодействий приложения.'),
    ('kg02_external', 'kg03_external_interaction', 'related_concept', 'Взаимодействие с окружением и внешним миром пересекаются.'),
    ('kg02_server', 'kg03_external_interaction', 'related_concept', 'Клиент-серверные отношения — один возможный пример взаимодействия.'),
    ('kg01_interop', 'kg03_external_interaction', 'related_concept', 'Межпрограммное взаимодействие включает синхронные и асинхронные формы.'),
    ('kg01_state_storage', 'kg03_recovery', 'related_concept', 'Восстановление после сбоя зависит от сохраняемого состояния и гарантий хранения.'),
    ('kg02_formats', 'kg03_state_storage', 'related_concept', 'Форматы сериализации могут применяться при хранении состояния.'),
]
extra = [{'from': x, 'to': y, 'relation': rel, 'origin': 'pedagogical_inference',
          'confidence': 'medium', 'note': reason} for x, y, rel, reason in links]
all_nodes = [n for obj in old + [new] for n in obj['nodes']]
all_edges = [e for obj in old + [new] for e in obj['edges']] + old_links + extra
combined = {'schema_version': '1.0', 'graph_id': 'KG_ALL',
            'title': 'Codex course — handwritten concept maps 1–3', 'language': 'ru',
            'status': 'draft_three_sheets_transcribed',
            'nodes': all_nodes, 'edges': all_edges}
write_json(GRAPHS / 'combined.json', combined)
write_json(GRAPHS / 'alignments.json', {
    'schema_version': '1.0',
    'description': 'Proposed semantic alignment; original nodes remain separate. No automatic merging.',
    'alignments': [e for e in extra if e['relation'] in ('same_concept_candidate', 'overlapping_concepts')]
})

# Mermaid: transcribed arrows solid; inferred annotation text dotted.
def escape_mermaid(text: str) -> str:
    return text.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', ' ')

def as_mermaid(obj: dict) -> str:
    result = ['flowchart LR']
    for node in obj['nodes']:
        result.append(f'  {node["id"]}["{escape_mermaid(node["label"])}"]')
    for edge in obj['edges']:
        arrow = '-->' if edge['origin'] == 'handwriting' else '-.->'
        result.append(f'  {edge["from"]} {arrow} {edge["to"]}')
    return '\n'.join(result) + '\n'

mmd = as_mermaid(new)
(GRAPHS / 'kg03.mmd').write_text(mmd, encoding='utf-8')
(GRAPHS / 'kg03.md').write_text('# KG-03 — Приложение\n\nСплошная стрелка — нарисована; пунктир — соседняя подпись, соотнесённая при цифровой транскрипции.\n\n```mermaid\n' + mmd + '```\n', encoding='utf-8')

# Cross-graph overview deliberately limited to macro branches: not the unreadable 120+ node dump.
overview = '''# Три карты: обзор (концептуальная модель)

**Пунктирные связи на этой схеме добавлены при интеграции; они не присутствуют на фотографиях.**

```mermaid
flowchart LR
  A["KG-01 · Действия с кодом"]
  B["KG-02 · Свойства кода"]
  C["KG-03 · Приложение"]
  A --> A1["Создавать, запускать, проверять"]
  A --> A2["Хранить состояние"]
  B --> B1["Типы, функции, парадигмы"]
  B --> B2["Сети, форматы, исполнение"]
  C --> C1["Диагностика и восстановление"]
  C --> C2["Доступ и аудит"]
  C --> C3["Внешние взаимодействия"]
  C --> C4["Хранение состояния"]
  A2 -. "возможно то же понятие" .-> C4
  B2 -. "частичное пересечение" .-> C3
  A1 -. "тесты ≠ диагностика" .-> C1
```

- Полные карты: [KG-01](kg01.md), [KG-02](kg02.md), [KG-03](kg03.md).
- `combined.json` — все узлы, нарисованные стрелки и отдельно помеченные педагогические связи.
- `alignments.json` — совпадающие и пересекающиеся концепты без разрушительного слияния.
'''
(GRAPHS / 'overview.md').write_text(overview, encoding='utf-8')

# Complete readable sheet transcript including uncertain text, provenance caveat.
transcription = '''# Расшифровка трёх рукописных карт

> Ручная визуальная реконструкция, **не** точная OCR-копия. Русский текст нормализован в узлах JSON; `raw_label` сохраняет форму записи там, где она отличается. Стрелки только там, где они видны на листе. Подписи без стрелок отмечены отдельно.

'''
for obj in old + [new]:
    transcription += f'## {obj["graph_id"]}: {obj["title"]}\n\n'
    by_id = {n['id']: n for n in obj['nodes']}
    children = {}
    for edge in obj['edges']:
        if edge['origin'] == 'handwriting':
            children.setdefault(edge['from'], []).append(edge['to'])
    annotations = {}
    for edge in obj['edges']:
        if edge['origin'] != 'handwriting':
            annotations.setdefault(edge['from'], []).append(edge['to'])
    def walk(node_id, level, visited):
        nonlocal_holder = None
        lines = []
        for child_id in children.get(node_id, []):
            if child_id in visited:
                continue
            visited.add(child_id)
            n = by_id[child_id]
            lab = n['label']
            extra = []
            if n['provenance']['confidence'] != 'high':
                extra.append('прочтение требует проверки')
            if n.get('raw_label'):
                extra.append('на листе: ' + n['raw_label'])
            suffix = (' [' + '; '.join(extra) + ']') if extra else ''
            lines.append('  '*level + '- ' + lab + suffix)
            for annotation in annotations.get(child_id, []):
                an = by_id[annotation]
                qualifier = ' [подпись рядом без отдельной стрелки]'
                if an['provenance']['confidence'] != 'high':
                    qualifier += ' [уточнить чтение]'
                if an.get('raw_label'):
                    qualifier += ' [на листе: ' + an['raw_label'] + ']'
                lines.append('  '*(level+1) + '- ' + an['label'] + qualifier)
            lines.extend(walk(child_id, level+1, visited))
        return lines
    transcription += '\n'.join(walk(obj['nodes'][0]['id'], 0, set())) + '\n\n'
    if obj['graph_id'] == 'KG02':
        transcription += 'Отдельное слово `framework` не имеет видимого ребра к центру.\n\n'
transcription += '''## Вопросы к автору фотографии KG-03

- Под словом «креды» (предположительное чтение) имелись в виду **credentials / учётные данные**?
- В строке хранения данных слово «Postgress»/«Postgres» нормализовано как PostgreSQL — подтверждается ли это?
- Взаимосвязи подписей Loki/Kibana/Elasticsearch, eBPF/flame graphs и RabbitMQ/Kafka с ближайшими ветками на рисунке *подразумеваются*, но отдельные стрелки не проведены. Эти связи остаются предположениями.
'''
(BASE / 'TRANSCRIPTION.md').write_text(transcription, encoding='utf-8')

mapping = '''# Сопоставление трёх карт с курсом Codex

Сверено с публичными `README.md`, `COURSE-OUTLINE.md` и `CURRICULUM-DESIGN.md` репозитория `s1onique/codex-course` (ветка main, 2026-11-11). Это **предложение** для преподавателя, а не новые требования к ученику. Репозиторий не изменён.

| Фаза | Связанные темы | Как отрабатывать на сквозном трекере задач |
|---|---|---|
| I — Первый успех | KG-01: редактор, папка проекта, локальный запуск, Git | Сохранить и запустить страницу, проверить вручную в браузере |
| II — Понимание программы | KG-02: переменные, функции, циклы, ветвления; KG-03: **самая простая** отладка и логирование | Понять `console.log` и ошибки в DevTools; найти причину поломки |
| III — Корректность и состояние | KG-01: тесты; KG-02: типы/функции; KG-03: состояние в памяти vs сохранённое | Чистые функции, тесты переходов статуса задач, граничные случаи |
| IV — Сопровождаемое ПО | KG-01: структура и документы; KG-02: модули и интерфейсы; KG-03: диагностируемость | Разделить UI и модель, добавить полезные ошибки без вывода секретов |
| V — Прикладные приложения | KG-02: HTTP, JSON, клиент/сервер; KG-03: БД, аутентификация/авторизация, обработка отказов, синхронные запросы | Серверное API, сохранение задач, ошибки сети, доступ к данным |
| VI — Самостоятельная инженерия | KG-03: аудит, восстановление, асинхронные события; KG-01: повторяемые сборки, эксплуатация | Диагностировать и исправлять сбой, обосновывать безопасность и надёжность |

**На продвинутую/факультативную полку:** ELK/Kibana, Loki, eBPF, flame graphs, Keycloak/AD FS, Kafka/RabbitMQ, Cassandra, retry policies с backoff. Для первых уроков эти технологии не нужны.

## Типы отношений и жизненный цикл

- `has_branch` — реально нарисованная стрелка **темы → подтемы**; не является учебной предпосылкой.
- `annotates` — подпись находится возле ветки, но отдельной стрелки на фотографии нет; связь — педагогическая гипотеза.
- `same_concept_candidate` — вероятно одно понятие в нескольких листах; исходные узлы остаются отдельными.
- `overlapping_concepts` — пересечение с различающимися примерами; **не** полная тождественность.
- `related_concept` — содержательная связь, предложенная при интеграции, не нарисована.
- `requires` — строго отдельный DAG учебных предпосылок, **пока не создан**.
- `covered_by`, `assessed_by` — будущие связи с уроками и измеримыми проверками.

## Зафиксированные концептуальные оговорки

1. `KG01 state_storage` ↔ `KG03 state_storage` — очевидное совпадение темы; аналогично «в файлах» и «в кэше». Не сливать без подтверждения.
2. Кэш Redis и долговременное хранение: разные гарантии; Redis может быть настроен на сохранение, но кэш как таковой не гарантирует долговечность.
3. `fail-fast` и `restart` — не синонимы. `exponential backoff` — *стратегия задержек между попытками*, а не гарантия успешного восстановления; следует добавить jitter, условия прекращения и классификацию ошибок на продвинутом этапе.
4. Аутентификация и авторизация — разные этапы; Keycloak/AD FS относятся к системам управления удостоверениями, а «креды» — не система.
5. «Аудит-логи», прикладное логирование, метрики и профилирование — разные виды свидетельств о работе приложения. Их нельзя приравнивать.
6. Синхронное/асинхронное взаимодействие **не** эквивалентно HTTP/очереди, не следует утверждать жёсткой технологии-зависимости.
7. Kafka и RabbitMQ — не взаимозаменяемые в деталях; объяснять различия только при необходимости.
8. REST, HTTP, gRPC, SOAP из KG-02 — разные концептуальные уровни; не обучать их как однородный список альтернатив.
9. Проверка кода, тестирование, диагностика работающего приложения и наблюдаемость — пересекающиеся, но различные дисциплины.
10. Явно запрещено автоматически извлекать `requires` из каждой стрелки рукописи: это карта идей, не доказанная теория порядка освоения.

## Следующий итерационный шаг

1. Уточнить 2 сомнительных подписи KG-03 и сомнительные области двух предыдущих листов.
2. Присвоить уникальным нормализованным понятиям канонические `concept_id`, сохранять все `occurrence_id` и фотографии отдельно.
3. Создать минимальные зависимости `requires` на **уровне понятий**, проверить DAG (без циклов) и трассировать каждое ребро к учебной цели.
4. Для каждого понятия добавить `introduced_in`, `practiced_in`, `assessed_in`, но только после проверки актуальной реализации уроков на выбранной ветке.
5. Сделать проверяемую матрицу покрытия (нет незакреплённых узлов и ложного статуса «изучено»).
'''
(BASE / 'COURSE-MAPPING.md').write_text(mapping, encoding='utf-8')

stats = {
    'KG01': (len(old[0]['nodes']), len(old[0]['edges'])),
    'KG02': (len(old[1]['nodes']), len(old[1]['edges'])),
    'KG03': (len(new['nodes']), len(new['edges']))
}
readme = f'''# Карты знаний курса «Программная инженерия с Codex»

**Статус: DRAFT** — все три бумажных листа транскрибированы, но онтология, пререквизиты и терминология ещё не утверждены. Изображения и оригинальные формулировки имеют приоритет над нашей интерпретацией.

| Лист | Тема | Узлы | Связи внутри листа |
|---|---|---:|---:|
| KG-01 | Действия с кодом | {stats['KG01'][0]} | {stats['KG01'][1]} |
| KG-02 | Свойства кода | {stats['KG02'][0]} | {stats['KG02'][1]} |
| KG-03 | Приложение | {stats['KG03'][0]} | {stats['KG03'][1]} |
| **Итого** | | **{len(all_nodes)}** | **{sum(x[1] for x in stats.values())}** |

Дополнительно: {len(old_links) + len(extra)} педагогических **межграфовых** связей; граф `combined.json` содержит {len(all_edges)} связей в сумме.

## Содержимое

- `sources/kg0*-*.jpg` — ориентированные фотографии; третий лист сохранён также как `kg03-application-original.jpg` без обработки.
- `TRANSCRIPTION.md` — ручная реконструкция с проверяемыми оговорками о почерке и стрелках.
- `graphs/kg01.json`, `kg02.json`, `kg03.json` — отдельные графы и происхождение узлов.
- `graphs/combined.json` — объединённая **карта вхождений**, не смешивающая тождество и расположение на бумаге.
- `graphs/alignments.json` — кандидаты на одинаковые/частично пересекающиеся понятия, без разрушительного merge.
- `graphs/kg0*.md` + `.mmd` — отдельные схемы Mermaid для GitHub.
- `graphs/overview.md` — компактная схема трёх карт, с явно предложенными межграфовыми отношениями.
- `COURSE-MAPPING.md` — привязка к шести фазам курса и технические уточнения.
- `scripts/validate.py` — автономная проверка уникальности IDs, существования целей рёбер, целостности объединения и происхождения; Python stdlib.

## Семантика

- `origin=handwriting` — реально видимая стрелка между написанными понятиями.
- `origin=pedagogical_inference` — наше дополнение; не выдавать за факт, присутствующий на листе.
- `provenance.confidence=medium` — неоднозначное чтение.
- Даже если одинаковые слова встречаются в разных картах, у них отдельные ID; кандидаты на совпадения хранятся в `alignments.json`.
- `has_branch` — **не** `requires`. Учебные зависимости пока не строились.

Проверка: `python scripts/validate.py` (из корня распакованного пакета). Стандартная библиотека Python, без установки зависимостей.

**GitHub `s1onique/codex-course` не изменён.** Mermaid поддерживается в Markdown на GitHub: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams
'''
(BASE / 'README.md').write_text(readme, encoding='utf-8')

# Invariant validations are run explicitly via scripts/validate.py after this script.
print('Graphs:', stats)
print('Total nodes:', len(all_nodes), 'edges:', len(all_edges), 'intergraph links:', len(old_links) + len(extra))
