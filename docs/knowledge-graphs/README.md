# Карты знаний курса «Программная инженерия с Codex»

**Статус: DRAFT** — все три бумажных листа транскрибированы, но онтология, пререквизиты и терминология ещё не утверждены. Изображения и оригинальные формулировки имеют приоритет над нашей интерпретацией.

| Лист | Тема | Узлы | Связи внутри листа |
|---|---|---:|---:|
| KG-01 | Действия с кодом | 35 | 34 |
| KG-02 | Свойства кода | 57 | 55 |
| KG-03 | Приложение | 29 | 28 |
| **Итого** | | **121** | **117** |

Дополнительно: 24 педагогических **межграфовых** связей; граф `combined.json` содержит 141 связей в сумме.

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

## Производная онтология (`ontology/`)

Слой, построенный **поверх** рукописных карт. Рукописный слой при этом не изменяется: всё производное воспроизводится генераторами из исходных JSON.

| Файл | Что это |
|---|---|
| `ontology/concepts.json` | Канонический реестр: 121 вхождение → 116 понятий; 5 объявленных слияний, каждое с обоснованием |
| `ontology/prerequisites.json` | Отдельный типизированный DAG предпосылок (31 ребро); **не** выведен из стрелок рукописи |
| `ontology/lesson-mapping.json` | `introduced_in` / `practiced_in` / `assessed_in` со статусом `verified` (23) или `proposed` (38) |
| `ontology/audit.json` | Аудит транскрипции: 61 находка, 33 открытых; ничего не додумывается |
| `ontology/gap-analysis.json` / `.md` | Покрытие и пробелы; все числа вычисляются из артефактов |

Генераторы: `scripts/build_registry.py`, `build_prerequisites.py`, `build_lesson_mapping.py`, `build_audit.py`, `build_gap_analysis.py`. Пересборка всех пяти даёт побайтово тот же результат.

Проверки:

```sh
python scripts/validate.py            # рукописный слой (не изменён)
python scripts/validate_ontology.py   # производный слой
python -m unittest discover -s docs/knowledge-graphs/tests
```

### Три слоя доказательства

| Слой | Маркер | Где |
|---|---|---|
| Рукописный факт | `origin=handwriting`, `provenance.evidence=handwriting` | `graphs/**` |
| Интерпретация | `merge_rationale`, `confidence=medium`, `review_note`, `declared_non_merges` | `ontology/concepts.json`, `ontology/audit.json` |
| Педагогическое предложение | `origin=pedagogical_proposal`, `status=proposed`, `rationale`, `traced_to` | `ontology/prerequisites.json`, `ontology/lesson-mapping.json` |

Покрытие уроками со статусом `verified` подтверждается дословным якорем в реальном файле урока; `proposed` означает, что урок ещё не написан, и якоря не имеет by design.


## Семантика

- `origin=handwriting` — реально видимая стрелка между написанными понятиями.
- `origin=pedagogical_inference` — наше дополнение; не выдавать за факт, присутствующий на листе.
- `provenance.confidence=medium` — неоднозначное чтение.
- Даже если одинаковые слова встречаются в разных картах, у них отдельные ID; кандидаты на совпадения хранятся в `alignments.json`.
- `has_branch` — **не** `requires`. Учебные зависимости пока не строились.

Проверка: `python scripts/validate.py` (из корня распакованного пакета). Стандартная библиотека Python, без установки зависимостей.

**GitHub `s1onique/codex-course` не изменён.** Mermaid поддерживается в Markdown на GitHub: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams
