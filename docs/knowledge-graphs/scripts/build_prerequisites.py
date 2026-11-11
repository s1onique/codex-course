#!/usr/bin/env python3
"""Build the typed prerequisite DAG for the curriculum ontology.

Stdlib only. Deterministic.

CRITICAL RULE (per docs/knowledge-graphs/COURSE-MAPPING.md, оговорка 10):
prerequisites are NOT mechanically extracted from handwritten arrows. The
handwritten map records what the author drew; this file records what we
propose to TEACH, in what order, and why. Every edge therefore carries:

  * `origin`      = 'pedagogical_proposal'  (never 'handwriting')
  * `rationale`   = why this ordering is defensible, in words
  * `traced_to`   = the curriculum objective / phase it serves
  * `confidence`  = how firm the proposal is

Edge types are deliberately few and typed:
  * `prerequisite_of`   - A must be understood before B can be introduced
  * `enables`           - inverse spelling, used for cross-phase bridges

The DAG is checked for acyclicity here and again in the test suite.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'ontology' / 'prerequisites.json'
REGISTRY = ROOT / 'ontology' / 'concepts.json'

# ---------------------------------------------------------------------------
# Edges are written by hand, one line of intent per edge.
# `from` must be understood before `to` is introduced.
#
# Two id namespaces are used, and they are NOT interchangeable:
#   concept_*  - a canonical concept that exists in ontology/concepts.json,
#                i.e. it is grounded in at least one handwritten occurrence.
#   course:*   - a pedagogical concept that exists ONLY in the course design
#                (CURRICULUM-DESIGN.md / COURSE-OUTLINE.md) and has no
#                handwritten counterpart. It is a proposal, not transcription.
# ---------------------------------------------------------------------------
EDGES = [
    # --- Phase I -> Phase II ---
    {
        'from': 'course:working_with_agent_and_local_project',
        'to': 'concept_peremennye',
        'relation': 'prerequisite_of',
        'rationale': 'Понятие «значение/переменная» вводится на уже знакомой странице, чтобы не менять два объекта сразу.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: значения, управление, функции, структуры данных',
        'confidence': 'high',
    },
    {
        'from': 'course:working_with_agent_and_local_project',
        'to': 'concept_vetvleniya',
        'relation': 'prerequisite_of',
        'rationale': 'Ветвление объясняется на знакомом рабочем контексте, а не как абстрактный синтаксис.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: управляющие конструкции',
        'confidence': 'high',
    },
    {
        'from': 'concept_peremennye',
        'to': 'concept_vetvleniya',
        'relation': 'prerequisite_of',
        'rationale': 'Условие читает значение переменной; без понятия значения условие превращается в магическое число.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: управляющие конструкции',
        'confidence': 'high',
    },
    {
        'from': 'concept_peremennye',
        'to': 'concept_funkcii',
        'relation': 'prerequisite_of',
        'rationale': 'Функция без понятия значения — набор букв; параметр и аргумент различаются только через значение.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: функции',
        'confidence': 'high',
    },
    {
        'from': 'concept_vetvleniya',
        'to': 'concept_funkcii',
        'relation': 'prerequisite_of',
        'rationale': 'Урок 05 прямо переиспользует порог из Урока 04 внутри функции.',
        'traced_to': 'LESSON-05.md, Шаг 1 — «расчёт, который в Уроке 04 был написан дважды»',
        'confidence': 'high',
    },
    {
        'from': 'concept_vetvleniya',
        'to': 'concept_cikly',
        'relation': 'prerequisite_of',
        'rationale': 'Условие внутри цикла («пока не конец») — первое, что новичок видит в цикле.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: управляющие конструкции',
        'confidence': 'medium',
    },
    {
        'from': 'concept_funkcii',
        'to': 'concept_cikly',
        'relation': 'prerequisite_of',
        'rationale': 'Цикл — это повторяющийся вызов: без понятия функции цикл нечем выполнять.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: управляющие конструкции',
        'confidence': 'medium',
    },
    {
        'from': 'concept_cikly',
        'to': 'concept_funkcii_vysshego_poryadka',
        'relation': 'prerequisite_of',
        'rationale': 'Функция высшего порядка передаёт функцию в функцию; без цикла и обычной функции смысл не читается.',
        'traced_to': 'CURRICULUM-DESIGN.md C.2 — Фаза II: управление и структуры данных',
        'confidence': 'low',
    },
    {
        'from': 'concept_funkcii',
        'to': 'concept_moduli',
        'relation': 'prerequisite_of',
        'rationale': 'Граница модуля — это граница ответственности функции; без неё деление произвольно.',
        'traced_to': 'CURRICULUM-DESIGN.md C.3 — «Модули | Функции, чистые функции, тесты | Нет»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_funkcii',
        'to': 'concept_klassy',
        'relation': 'prerequisite_of',
        'rationale': 'Метод — это функция с привязкой к состоянию объекта; без понятия функции класс не читается.',
        'traced_to': 'CURRICULUM-DESIGN.md D.6 — ООП',
        'confidence': 'medium',
    },
    {
        'from': 'concept_moduli',
        'to': 'concept_interfejsy',
        'relation': 'prerequisite_of',
        'rationale': 'Интерфейс — это контракт модуля; его имеет смысл обсуждать после того, как модуль выделен.',
        'traced_to': 'CURRICULUM-DESIGN.md D.10 — Design by Contract',
        'confidence': 'medium',
    },
    {
        'from': 'concept_moduli',
        'to': 'concept_setevoe_vzaimodejstvie',
        'relation': 'prerequisite_of',
        'rationale': 'Сетевое взаимодействие появляется как «вызов модуля, который находится не в этой программе».',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — HTTP, API',
        'confidence': 'medium',
    },
    {
        'from': 'concept_setevoe_vzaimodejstvie',
        'to': 'concept_server',
        'relation': 'prerequisite_of',
        'rationale': 'Роли «кто зовёт» и «кто отвечает» вводятся вместе с сетевым взаимодействием, а не раньше.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — HTTP: запрос, ответ, статус-код, заголовок',
        'confidence': 'medium',
    },
    {
        'from': 'concept_setevoe_vzaimodejstvie',
        'to': 'concept_http',
        'relation': 'prerequisite_of',
        'rationale': 'HTTP — это соглашение о формате сетевого сообщения; без понятия сообщения его не из чего построить.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — HTTP',
        'confidence': 'medium',
    },
    {
        'from': 'concept_setevoe_vzaimodejstvie',
        'to': 'concept_sinhronnoe',
        'relation': 'prerequisite_of',
        'rationale': 'Синхронность/асинхронность — свойство взаимодействия; без понятия взаимодействия она не о чём.',
        'traced_to': 'KG03 «Взаимодействие с внешним миром»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_http',
        'to': 'concept_formaty_dannyh',
        'relation': 'prerequisite_of',
        'rationale': 'Формат полезной нагрузки HTTP определяется форматом данных (JSON/XML); сначала формат, потом протокол.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — «JSON и сериализация»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_server',
        'to': 'concept_state_storage',
        'relation': 'prerequisite_of',
        'rationale': 'Хранение состояния выбирается под серверную часть: «в памяти процесса» и «в файле» — разные ответы.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — «постоянное хранение»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_formaty_dannyh',
        'to': 'concept_state_storage',
        'relation': 'prerequisite_of',
        'rationale': 'Прежде чем выбирать хранилище, нужно уметь представить данные в переносимом виде.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — «JSON и сериализация», «постоянное хранение»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_diagnostika',
        'to': 'concept_logirovanie',
        'relation': 'prerequisite_of',
        'rationale': 'Логирование — инструмент диагностики; сначала зачем искать, потом чем искать.',
        'traced_to': 'KG03 «Диагностика»; COURSE-OUTLINE.md Фаза V — «в логах видно, что происходит при ошибке»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_diagnostika',
        'to': 'concept_otladka',
        'relation': 'prerequisite_of',
        'rationale': 'Отладка — частный случай диагностики: тот же цикл «воспроизвести → сузить → проверить».',
        'traced_to': 'COURSE-OUTLINE.md Фаза II — «отладка: воспроизвести ошибку, сузить область поиска, проверить гипотезу»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_logirovanie',
        'to': 'concept_audit_logi',
        'relation': 'prerequisite_of',
        'rationale': 'Аудит-лог — это логирование с требованием доказать, кто и что делал; формат и доставка уже знакомы.',
        'traced_to': 'KG03 «События безопасности» / «Аудит-логи»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_autentifikaciya_i_avtorizaciya',
        'to': 'concept_audit_logi',
        'relation': 'prerequisite_of',
        'rationale': 'Аудит-лог — доказательство того, кто и что делал; без модели доступа он бессмысленен.',
        'traced_to': 'COURSE-OUTLINE.md Фаза VI — аудит, восстановление',
        'confidence': 'medium',
    },
    {
        'from': 'concept_otladka',
        'to': 'concept_vosstanovlenie_posle_sboev',
        'relation': 'prerequisite_of',
        'rationale': 'Диагностика показывает, что сломалось; восстановление — что делать дальше.',
        'traced_to': 'COURSE-OUTLINE.md Фаза VI — «восстановление»',
        'confidence': 'medium',
    },
    {
        'from': 'course:failure_handling',
        'to': 'concept_vosstanovlenie_posle_sboev',
        'relation': 'prerequisite_of',
        'rationale': 'Политика восстановления выбирается после того, как научились различать «сломались» и «вернулась ошибка».',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — критерий выхода 1',
        'confidence': 'medium',
    },
    {
        'from': 'concept_state_storage',
        'to': 'concept_vosstanovlenie_posle_sboev',
        'relation': 'prerequisite_of',
        'rationale': 'Гарантии хранения определяют, что вообще можно восстановить после сбоя.',
        'traced_to': 'COURSE-OUTLINE.md Фаза VI — «восстановление»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_vosstanovlenie_posle_sboev',
        'to': 'concept_exponential_backoff',
        'relation': 'prerequisite_of',
        'rationale': 'Backoff — это стратегия задержек между попытками восстановления; без понятия восстановления она бессмысленна.',
        'traced_to': 'KG03 «Восстановление после сбоев»; COURSE-MAPPING.md, оговорка 3',
        'confidence': 'medium',
    },
    {
        'from': 'concept_state_storage',
        'to': 'concept_storage_in_files',
        'relation': 'prerequisite_of',
        'rationale': '«В файлах» — первый и самый простой способ хранения; его выбирают раньше СУБД.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — «постоянное хранение»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_storage_in_files',
        'to': 'concept_storage_in_cache',
        'relation': 'prerequisite_of',
        'rationale': 'Кэш вводится как ускорение поверх уже понятного хранения, а не как замена ему.',
        'traced_to': 'COURSE-MAPPING.md, оговорка 2 — «кэш не гарантирует долговременность»',
        'confidence': 'medium',
    },
    {
        'from': 'concept_storage_in_cache',
        'to': 'concept_storage_rdbms',
        'relation': 'prerequisite_of',
        'rationale': 'СУБД вводится как «то, что переживает перезапуск и поддерживает запросы», после знакомства с кэшем и файлами.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — «постоянное хранение»',
        'confidence': 'low',
    },
    {
        'from': 'concept_storage_rdbms',
        'to': 'concept_storage_nosql',
        'relation': 'prerequisite_of',
        'rationale': 'NoSQL вводится как альтернатива, осмысленная только после того, как понятна реляционная модель.',
        'traced_to': 'COURSE-OUTLINE.md Фаза V — «базы данных и SQL» (углублённая тема)',
        'confidence': 'low',
    },
    {
        'from': 'concept_vzaimodejstvie_s_vneshnim_mirom',
        'to': 'concept_asinhronnoe',
        'relation': 'prerequisite_of',
        'rationale': 'Асинхронность — второй способ взаимодействия; его сравнивают с уже освоенным синхронным.',
        'traced_to': 'KG03 «Взаимодействие с внешним миром»',
        'confidence': 'medium',
    },
]

# Pedagogical concepts that exist only in the course design. They have no
# handwritten counterpart, so they are NOT in the canonical registry and are
# kept in a separate, explicitly-labelled namespace.
COURSE_ONLY_CONCEPTS = [
    {
        'id': 'course:working_with_agent_and_local_project',
        'label': 'Работа с агентом в локальном проекте',
        'source': 'COURSE-OUTLINE.md Фаза I; LESSON-01.md',
        'reason': 'Навык есть в уроках 00–01, но на рукописных листах отдельного узла нет.',
    },
    {
        'id': 'course:failure_handling',
        'label': 'Обработка отказов',
        'source': 'COURSE-OUTLINE.md Фаза V — «обработка отказов»',
        'reason': 'На KG03 есть «Отладка» и «Восстановление после сбоев», но отдельного узла «обработка отказов» нет.',
    },
]

# Concepts that are deliberately kept OUT of the prerequisite DAG.
# Rationale is recorded so the omission is auditable, not accidental.
OUT_OF_DAG = [
    {
        'concept_id': 'concept_git',
        'reason': 'Git — инструмент Фазы I, раскрывается раньше любого узла этой карты; отдельное ребро создавало бы ложную зависимость.',
    },
    {
        'concept_id': 'concept_kak_testirovat_kod',
        'reason': 'Вопрос-узел, а не понятие; в карте покрытия он остаётся как тема, но не становится вершиной порядка.',
    },
]


def detect_cycle(edges):
    """Return a cycle as a list of concept ids, or None if the graph is acyclic."""
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
    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    known = {c['concept_id'] for c in registry['concepts']}
    course_only = {c['id'] for c in COURSE_ONLY_CONCEPTS}
    resolvable = known | course_only

    edges = []
    for edge in EDGES:
        for end in ('from', 'to'):
            assert edge[end] in resolvable, 'unknown concept in edge: %s' % edge[end]
            if edge[end].startswith('course:'):
                assert edge[end] in course_only, \
                    'course: id is not declared in COURSE_ONLY_CONCEPTS: %s' % edge[end]
        item = dict(edge)
        item['origin'] = 'pedagogical_proposal'
        item['edge_id'] = 'prereq_%02d_%s__%s' % (
            len(edges) + 1, edge['from'], edge['to'])
        edges.append(item)

    keys = [(e['from'], e['to'], e['relation']) for e in edges]
    assert len(keys) == len(set(keys)), 'duplicate prerequisite edge'
    assert all(e['origin'] == 'pedagogical_proposal' for e in edges)
    assert all(e.get('rationale') and e.get('traced_to') for e in edges), \
        'every prerequisite edge needs a rationale and a trace'

    cycle = detect_cycle(edges)
    assert cycle is None, 'cycle in prerequisite DAG: %s' % cycle

    graph = {
        'schema_version': '1.0',
        'artifact': 'prerequisite_dag',
        'status': 'draft_pending_author_review',
        'generator': 'scripts/build_prerequisites.py',
        'policy': {
            'separation_from_handwritten': (
                'Этот граф НЕ строится из стрелок рукописи. Рукописная карта фиксирует '
                'изображение листа; этот файл фиксирует предложение по порядку '
                'преподавания. Ни одно ребро здесь не имеет origin=handwriting.'
            ),
            'edge_types': {
                'prerequisite_of': 'A должно быть понято раньше, чем B вводится.',
            },
            'id_namespaces': {
                'concept_*': 'Каноническое понятие из ontology/concepts.json; связано минимум с одним handwritten-вхождением.',
                'course:*': 'Педагогическое понятие только из проектирования курса; рукописного соответствия нет.',
            },
            'acyclicity': 'Проверяется в scripts/build_prerequisites.py и в тестах.',
        },
        'counts': {
            'edge_count': len(edges),
            'node_count': len({e['from'] for e in edges} | {e['to'] for e in edges}),
            'by_confidence': {
                c: sum(1 for e in edges if e['confidence'] == c)
                for c in ('high', 'medium', 'low')
            },
        },
        'edges': edges,
        'course_only_concepts': COURSE_ONLY_CONCEPTS,
        'out_of_dag': OUT_OF_DAG,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(graph, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('WROTE %s: edges=%d nodes=%d acyclic=OK'
          % (OUT, graph['counts']['edge_count'], graph['counts']['node_count']))


if __name__ == '__main__':
    main()
