#!/usr/bin/env python3
"""Map canonical concepts to the lessons that actually exist.

Stdlib only. Deterministic.

Two coverage statuses are kept strictly apart:

  verified  - the lesson file was READ and the named section/anchor exists in
              it and covers the concept. The anchor is a literal string that
              must be findable in the lesson file; the test suite re-checks it.
  proposed - a pedagogical proposal for a lesson that DOES NOT EXIST YET.
              There is no file to verify, so no anchor is claimed and the
              lesson id is marked as not-yet-written.

Nothing here invents lesson content. A `proposed` entry names a lesson that
does not exist; the gap analysis reports it as a gap.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT.parents[1]          # repository root
ONT = ROOT / 'ontology'
OUT = ONT / 'lesson-mapping.json'

LESSON_FILES = {
    'LESSON-00': 'LESSON-00.md',
    'LESSON-01': 'LESSON-01.md',
    'LESSON-02': 'LESSON-02.md',
    'LESSON-03': 'LESSON-03.md',
    'LESSON-04': 'LESSON-04.md',
    'LESSON-05': 'LESSON-05.md',
    'LESSON-06': 'LESSON-06.md',
}

# ---------------------------------------------------------------------------
# VERIFIED coverage: (concept_id, relation, lesson, evidence anchor, note)
# The anchor MUST appear verbatim in the lesson file. `verify_anchor()` below
# checks this and the test suite re-checks it independently.
# ---------------------------------------------------------------------------
VERIFIED = [
    # --- LESSON-00: Git, локальный репозиторий ---
    ('concept_git', 'introduced_in', 'LESSON-00',
     '## Три названия, которые важно различать',
     'Урок 00 различает Git / GitHub / GitHub Desktop и объясняет, зачем нужен Git.'),
    ('concept_git', 'practiced_in', 'LESSON-00',
     '## Самостоятельная проверка',
     'Шаги 1–5 урока — практика: установка, клонирование, git status.'),
    ('concept_git', 'assessed_in', 'LESSON-00',
     '### Проверьте себя',
     'Критерий завершения урока 00 проверяет работу git и чтение его вывода.'),

    # --- LESSON-01: страница, браузер, проверка результата ---
    ('concept_gde_hranyat_kod', 'introduced_in', 'LESSON-01',
     'GitHub и папка на компьютере — не одно и то же.',
     'Урок 01 различает GitHub-репозиторий и локальную папку проекта.'),
    ('concept_gde_zapuskayut_kod', 'practiced_in', 'LESSON-01',
     'Откройте файл `practice/lesson-01/index.html` в браузере',
     'Ученик сам открывает страницу в браузере — это и есть «запуск кода у разработчика».'),
    ('concept_gitlab', 'introduced_in', 'LESSON-01',
     '## Дополнительно: сохраним на GitHub (необязательно, 10 минут)',
     'GitHub как сервис хранения кода; сам GitLab на листе KG01 упомянут рядом.'),

    # --- LESSON-02: чтение чужого кода ---
    ('concept_kak_dokumentirovat_kod_vnutri_pisat_kommentarii', 'introduced_in', 'LESSON-02',
     '### Три новых слова',
     'Урок 02 разбирает чужой код и объясняет, зачем нужны комментарии и понятные имена.'),

    # --- LESSON-03: значения, переменные, выражения ---
    ('concept_peremennye', 'introduced_in', 'LESSON-03',
     '## Что такое «значение», «переменная» и «выражение»',
     'Раздел определяет значение, переменную, присваивание и выражение.'),
    ('concept_peremennye', 'practiced_in', 'LESSON-03',
     '## Шаг 1. Predict — находим значение в коде (10 минут)',
     'Задание: найти переменную и ответить письменно.'),
    ('concept_peremennye', 'assessed_in', 'LESSON-03',
     '## Критерий завершения урока',
     'Критерий 1–2: самостоятельно найти переменную и назвать её значение.'),
    ('concept_operatory', 'introduced_in', 'LESSON-03',
     '### Значение (value)',
     'Урок 03 разбирает операторы в выражениях (`clicks + 1`, `=`, `===`).'),
    ('concept_operatory', 'assessed_in', 'LESSON-03',
     '**Отличаете** присваивание `=` от сравнения `===` на уровне «что делает»',
     'Критерий 4 урока 03 — различение операторов.'),
    ('concept_konstanty', 'introduced_in', 'LESSON-03',
     '### `let` и `const` — два способа объявить переменную',
     'Урок 03 вводит `const` и различает его с `let`.'),

    # --- LESSON-04: условия и ветвление ---
    ('concept_vetvleniya', 'introduced_in', 'LESSON-04',
     '## Шаг 1. Predict — сначала предсказываем (10 минут)',
     'Урок 04 — введение условия и ветвления на счётчике.'),
    ('concept_vetvleniya', 'practiced_in', 'LESSON-04',
     '### 3. Проверьте обе ветки',
     'Ученик проверяет обе ветви в браузере.'),
    ('concept_vetvleniya', 'assessed_in', 'LESSON-04',
     '## Критерий завершения урока',
     'Критерий завершения урока 04 — предсказать и проверить обе ветки.'),

    # --- LESSON-05: функции и параметры ---
    ('concept_funkcii', 'introduced_in', 'LESSON-05',
     '## Шаг 1. Predict — сначала предсказываем (10 минут)',
     'Урок 05 вводит функцию: объявление, вызов, параметр, аргумент, return.'),
    ('concept_funkcii', 'practiced_in', 'LESSON-05',
     '### 4. Проверьте в браузере',
     'Практика: вызов функции и проверка, что страница работает как раньше.'),
    ('concept_funkcii', 'assessed_in', 'LESSON-05',
     '## Критерий завершения урока',
     'Критерий завершения урока 05 — переписать повторяющийся расчёт в функцию и проверить.'),
    ('concept_funkcii__kg02_functions_abstract', 'practiced_in', 'LESSON-05',
     '### Где функция начинается и заканчивается',
     'Урок 05 работает с функцией как с «поведением с понятным именем, входом и результатом».'),

    # --- LESSON-06: массивы ---
    ('course:arrays', 'introduced_in', 'LESSON-06',
     '## Шаг 1. Predict — сначала предсказываем (10 минут)',
     'Урок 06 вводит массив как «одна переменная — несколько значений».'),
    ('course:arrays', 'practiced_in', 'LESSON-06',
     '### 3. Добавьте на страницу блок «Ближайшая задача»',
     'Практика: массив из трёх задач, вывод на страницу, push().'),
    ('course:arrays', 'assessed_in', 'LESSON-06',
     '## Критерий завершения урока',
     'Критерий 1–6 урока 06 — записать массив, объяснить индексы, length, push.'),
]

# ---------------------------------------------------------------------------
# PROPOSED coverage: lessons that DO NOT EXIST YET.
#
# `lesson_id` is a planned id, not a file. There is deliberately NO evidence
# anchor: nothing may be verified against a file that was never written.
# The lesson number is taken from the phase plan in COURSE-OUTLINE.md so the
# proposal is traceable, not invented.
# ---------------------------------------------------------------------------
PROPOSED = [
    ('concept_cikly', 'introduced_in', 'LESSON-07',
     'Фаза II: цикл — первый урок после массивов; в COURSE-OUTLINE.md заявлен как обязательный.'),
    ('concept_funkcii_vysshego_poryadka', 'introduced_in', 'LESSON-07',
     'Фаза II: вводится вместе с циклом, когда уже есть массив и обычная функция.'),
    ('concept_klassy', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: ООП как отдельная тема после модулей и чистых функций.'),
    ('concept_obektno_orientirovannaya', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: парадигма ООП сравнивается с императивной на своей программе.'),
    ('concept_imperativnaya_procedurnaya', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: императивный подход как база для сравнения парадигм.'),
    ('concept_funkcionalnaya', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: функциональный подход — вторая половина обязательного сравнения.'),
    ('concept_deklarativnaya', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: декларативный подход в обязательной сравнительной таблице.'),
    ('concept_moduli', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: деление трекера на модули — практический проект фазы.'),
    ('concept_interfejsy', 'introduced_in', 'LESSON-PHASE-IV',
     'Фаза IV: интерфейс — «обещание модуля другим».'),
    ('concept_kak_testirovat_kod', 'introduced_in', 'LESSON-PHASE-III',
     'Фаза III: тесты как тема; критерий выхода фазы требует покрытых тестами кода.'),
    ('concept_kak_proverit_korrektnost_testov', 'introduced_in', 'LESSON-PHASE-III',
     'Фаза III: проверка корректности самих тестов.'),
    ('concept_kak_proverit_polnotu_testirovaniya_code_coverage', 'introduced_in', 'LESSON-PHASE-III',
     'Фаза III: полнота тестирования и code coverage — отдельная тема листа KG01.'),
    ('concept_setevoe_vzaimodejstvie', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: сетевое взаимодействие как обязательная компетенция фазы.'),
    ('concept_http', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: HTTP — запрос, ответ, статус-код, заголовок.'),
    ('concept_server', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: серверная часть трекера задач.'),
    ('concept_klient', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: клиентская часть как «вызов своего API».'),
    ('concept_json', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: JSON и сериализация.'),
    ('concept_xml', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: XML — второй формат данных; сравнивается с JSON.'),
    ('concept_formaty_dannyh', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: форматы данных как отдельная тема.'),
    ('concept_rest', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: REST как стиль взаимодействия поверх HTTP.'),
    ('concept_state_storage', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: постоянное хранение — что живёт в памяти, а что переживает перезагрузку.'),
    ('concept_storage_in_files', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: хранение в файлах — самый простой первый шаг.'),
    ('concept_storage_in_cache', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: кэш и его гарантии; отдельная оговорка в COURSE-MAPPING.md.'),
    ('concept_storage_rdbms', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: реляционная СУБД; в COURSE-OUTLINE.md отнесена к углублённым темам.'),
    ('concept_storage_nosql', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: NoSQL как альтернатива; в COURSE-OUTLINE.md отнесена к углублённым темам.'),
    ('concept_autentifikaciya_i_avtorizaciya', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: аутентификация и авторизация — обязательная компетенция фазы.'),
    ('concept_uchetnye_dannye', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: учётные данные и хранение секретов вне клиентского кода.'),
    ('concept_sobytiya_bezopasnosti', 'introduced_in', 'LESSON-PHASE-VI',
     'Фаза VI: события безопасности и их разбор.'),
    ('concept_audit_logi', 'introduced_in', 'LESSON-PHASE-VI',
     'Фаза VI: аудит-логи как доказательство действий.'),
    ('concept_diagnostika', 'introduced_in', 'LESSON-PHASE-II',
     'Фаза II: отладка как «воспроизвести, сузить, проверить гипотезу».'),
    ('concept_otladka', 'introduced_in', 'LESSON-PHASE-II',
     'Фаза II: отладка — обязательная компетенция фазы.'),
    ('concept_logirovanie', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: «в логах видно, что происходит при ошибке» — критерий выхода фазы.'),
    ('concept_vosstanovlenie_posle_sboev', 'introduced_in', 'LESSON-PHASE-VI',
     'Фаза VI: восстановление после сбоев.'),
    ('concept_fail_fast_restart', 'introduced_in', 'LESSON-PHASE-VI',
     'Фаза VI: fail-fast и restart — разные механизмы, разбираются раздельно.'),
    ('concept_exponential_backoff', 'introduced_in', 'LESSON-PHASE-VI',
     'Фаза VI: backoff как стратегия задержек, не как гарантия восстановления.'),
    ('concept_vzaimodejstvie_s_vneshnim_mirom', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: синхронное и асинхронное взаимодействие с внешним миром.'),
    ('concept_sinhronnoe', 'introduced_in', 'LESSON-PHASE-V',
     'Фаза V: синхронный запрос как базовый случай.'),
    ('concept_asinhronnoe', 'introduced_in', 'LESSON-PHASE-VI',
     'Фаза VI: асинхронные события.'),
]

# Lessons that are referenced as proposals but have no file. Listed explicitly
# so a reader can see at a glance which ids are real and which are plans.
PLANNED_ONLY = {
    'LESSON-07': 'Циклы и функции высшего порядка (план Фазы II).',
    'LESSON-PHASE-II': 'Отладка и диагностика (план Фазы II).',
    'LESSON-PHASE-III': 'Тесты, чистые функции, типы (план Фазы III).',
    'LESSON-PHASE-IV': 'Модули, ООП, сравнение парадигм (план Фазы IV).',
    'LESSON-PHASE-V': 'Сеть, хранение, доступы, отказы (план Фазы V).',
    'LESSON-PHASE-VI': 'Наблюдаемость, восстановление, выпуск (план Фазы VI).',
}

RELATIONS = ('introduced_in', 'practiced_in', 'assessed_in')

# Pedagogical concepts that exist only in the course design (no handwritten
# counterpart). Same namespace as in prerequisites.json.
COURSE_ONLY_CONCEPTS = [
    {
        'id': 'course:arrays',
        'label': 'Массив: несколько значений в одной переменной',
        'source': 'LESSON-06.md',
        'reason': 'Массив не записан на рукописных листах; он есть в уроке 06 и в плане Фазы II.',
    },
]


def verify_anchor(lesson_id, anchor):
    """Return True iff the anchor string is present in the lesson file."""
    path = COURSE / LESSON_FILES[lesson_id]
    text = path.read_text(encoding='utf-8')
    return anchor in text


def main():
    registry = json.loads((ONT / 'concepts.json').read_text(encoding='utf-8'))
    known = {c['concept_id'] for c in registry['concepts']}
    course_only = {c['id'] for c in COURSE_ONLY_CONCEPTS}
    resolvable = known | course_only

    coverage = {}

    def slot(concept_id, relation):
        return coverage.setdefault(concept_id, {}).setdefault(relation, [])

    for concept_id, relation, lesson_id, anchor, note in VERIFIED:
        assert concept_id in resolvable, 'unknown concept: %s' % concept_id
        assert relation in RELATIONS, 'unknown relation: %s' % relation
        assert lesson_id in LESSON_FILES, 'verified entry must name an existing lesson'
        assert verify_anchor(lesson_id, anchor), \
            'anchor not found in %s: %r' % (LESSON_FILES[lesson_id], anchor)
        slot(concept_id, relation).append({
            'lesson_id': lesson_id,
            'lesson_file': LESSON_FILES[lesson_id],
            'status': 'verified',
            'evidence_anchor': anchor,
            'note': note,
        })

    for concept_id, relation, lesson_id, note in PROPOSED:
        assert concept_id in resolvable, 'unknown concept: %s' % concept_id
        assert relation in RELATIONS, 'unknown relation: %s' % relation
        assert lesson_id in PLANNED_ONLY or lesson_id in LESSON_FILES, \
            'proposed lesson id is neither planned nor existing: %s' % lesson_id
        slot(concept_id, relation).append({
            'lesson_id': lesson_id,
            'lesson_file': None,
            'status': 'proposed',
            'evidence_anchor': None,
            'note': note,
        })

    records = []
    for concept_id in sorted(coverage):
        by_relation = coverage[concept_id]
        records.append({
            'concept_id': concept_id,
            'introduced_in': by_relation.get('introduced_in', []),
            'practiced_in': by_relation.get('practiced_in', []),
            'assessed_in': by_relation.get('assessed_in', []),
        })

    covered = {r['concept_id'] for r in records}
    uncovered = sorted(known - covered)
    uncovered_course_only = sorted(course_only - covered)

    mapping = {
        'schema_version': '1.0',
        'artifact': 'lesson_mapping',
        'status': 'draft_pending_author_review',
        'generator': 'scripts/build_lesson_mapping.py',
        'policy': {
            'verified': (
                'Урок существует в репозитории, указанный фрагмент дословно найден в его '
                'файле, и он покрывает это понятие. Проверяется повторно в тестах.'
            ),
            'proposed': (
                'Урок ещё не написан. Якоря нет by design: подтверждать нечего. '
                'Идентификатор урока — план, а не файл.'
            ),
            'no_fabrication': (
                'Ни одна запись со статусом verified не может ссылаться на '
                'несуществующий файл урока; ни одна запись со статусом proposed '
                'не содержит якорь.'
            ),
        },
        'counts': {
            'mapped_concepts': len(covered),
            'total_concepts': len(known),
            'uncovered_concepts': len(uncovered),
            'entries_verified': sum(
                1 for r in records for rel in RELATIONS
                for e in r[rel] if e['status'] == 'verified'),
            'entries_proposed': sum(
                1 for r in records for rel in RELATIONS
                for e in r[rel] if e['status'] == 'proposed'),
        },
        'existing_lessons': LESSON_FILES,
        'planned_only_lessons': PLANNED_ONLY,
        'course_only_concepts': COURSE_ONLY_CONCEPTS,
        'mapping': records,
        'uncovered_concepts': uncovered,
        'uncovered_course_only_concepts': uncovered_course_only,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('WROTE %s: mapped=%d/%d verified=%d proposed=%d uncovered=%d'
          % (OUT, mapping['counts']['mapped_concepts'], mapping['counts']['total_concepts'],
             mapping['counts']['entries_verified'], mapping['counts']['entries_proposed'],
             mapping['counts']['uncovered_concepts']))


if __name__ == '__main__':
    main()
