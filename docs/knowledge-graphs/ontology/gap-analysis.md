# Анализ покрытия и пробелов

> Сгенерировано `scripts/build_gap_analysis.py` из артефактов в `ontology/`.
> Числа в этом файле вычислены, а не вписаны вручную.
> Статус набора: **draft_pending_author_review**.

## 1. Сводка

| Показатель | Значение |
|---|---:|
| Рукописных вхождений (occurrences) | 121 |
| Канонических понятий (concepts) | 116 |
| Понятий, связанных с уроками | 50 |
| Понятий без покрытия уроками | 67 |
| Доля покрытия | 43.1% |
| Подтверждённых связей с уроками (verified) | 23 |
| Предложенных связей с уроками (proposed) | 38 |
| Понятий, покрытых только предложением | 38 |
| Рёбер в DAG предпосылок | 31 |
| Находок аудита транскрипции | 61 |
| Из них открытых | 33 |

## 2. Покрытие по листам рукописи

| Лист | Тема | Фото | Вхождений | Понятий | Покрыто | Не покрыто | Доля |
|---|---|---|---:|---:|---:|---:|---:|
| KG01 | Действия с кодом | `sources/kg01-actions.jpg` | 35 | 35 | 13 | 22 | 37% |
| KG02 | Свойства кода | `sources/kg02-properties.jpg` | 57 | 57 | 23 | 34 | 40% |
| KG03 | Приложение | `sources/kg03-application.jpg` | 29 | 29 | 18 | 11 | 62% |

## 3. Покрытие по урокам

### 3.1. Существующие уроки — покрытие подтверждено якорем в файле

| Урок | Файл | Введено | Отработано | Проверено |
|---|---|---:|---:|---:|
| LESSON-00 | `LESSON-00.md` | 1 | 1 | 1 |
| LESSON-01 | `LESSON-01.md` | 2 | 1 | 0 |
| LESSON-02 | `LESSON-02.md` | 1 | 0 | 0 |
| LESSON-03 | `LESSON-03.md` | 3 | 1 | 2 |
| LESSON-04 | `LESSON-04.md` | 1 | 1 | 1 |
| LESSON-05 | `LESSON-05.md` | 1 | 2 | 1 |
| LESSON-06 | `LESSON-06.md` | 1 | 1 | 1 |

### 3.2. Планируемые уроки — покрытие предложено, не подтверждено

| Планируемый урок | Содержание плана | Введено | Отработано | Проверено |
|---|---|---:|---:|---:|
| LESSON-07 | Циклы и функции высшего порядка (план Фазы II). | 2 | 0 | 0 |
| LESSON-PHASE-II | Отладка и диагностика (план Фазы II). | 2 | 0 | 0 |
| LESSON-PHASE-III | Тесты, чистые функции, типы (план Фазы III). | 3 | 0 | 0 |
| LESSON-PHASE-IV | Модули, ООП, сравнение парадигм (план Фазы IV). | 7 | 0 | 0 |
| LESSON-PHASE-V | Сеть, хранение, доступы, отказы (план Фазы V). | 18 | 0 | 0 |
| LESSON-PHASE-VI | Наблюдаемость, восстановление, выпуск (план Фазы VI). | 6 | 0 | 0 |

## 4. Пробелы

Пробел — это каноническое понятие, для которого **нет ни одного** урока,
который его покрывает. Ничего не выдумано: отсутствие покрытия и есть результат.

| Понятие | Подпись | Тип | Вхождения | Листы | Серьёзность |
|---|---|---|---|---|---|
| `concept_ad_fs` | AD FS | example | `kg03_adfs` | KG03 | low |
| `concept_assembler_assembler` | Assembler / ассемблер | example | `kg02_assembler` | KG02 | low |
| `concept_ast_abstraktnoe_sintaksicheskoe_derevo` | AST (абстрактное синтаксическое дерево) | concept | `kg02_ast` | KG02 | high |
| `concept_biblioteki` | Библиотеки | concept | `kg02_libraries` | KG02 | high |
| `concept_chem_pisat_kod` | Чем писать код? | question | `kg01_editor` | KG01 | low |
| `concept_dinamicheskaya` | Динамическая | concept | `kg02_dynamic` | KG02 | high |
| `concept_ebpf` | eBPF | example | `kg03_ebpf` | KG03 | low |
| `concept_elasticsearch` | Elasticsearch | example | `kg03_elasticsearch` | KG03 | low |
| `concept_flame_graphs` | Flame graphs | example | `kg03_flamegraphs` | KG03 | low |
| `concept_framework` | Framework | unlinked_term | `kg02_framework` | KG02 | low |
| `concept_grpc` | gRPC | example | `kg02_grpc` | KG02 | low |
| `concept_idea` | IDEA | example | `kg01_idea` | KG01 | low |
| `concept_interpretatorom` | Интерпретатором | concept | `kg02_interpreted` | KG02 | high |
| `concept_ir_promezhutochnoe_predstavlenie` | IR (промежуточное представление) | concept | `kg02_ir` | KG02 | high |
| `concept_iz_chego_sostoit_kod` | Из чего состоит код? | question | `kg02_composition` | KG02 | low |
| `concept_kafka` | Kafka | example | `kg03_kafka` | KG03 | low |
| `concept_kak_dokumentirovat_kod` | Как документировать код? | question | `kg01_document` | KG01 | low |
| `concept_kak_ispolnyaetsya_kod` | Как исполняется код? | question | `kg02_execution` | KG02 | low |
| `concept_kak_kod_vzaimodejstvuet_s_vneshnej_sredoj` | Как код взаимодействует с внешней средой? | question | `kg02_external` | KG02 | low |
| `concept_kak_obespechit_povtoryaemuyu_sborku` | Как обеспечить повторяемую сборку? | concept | `kg01_repro_build` | KG01 | high |
| `concept_kak_obmenivatsya_s_drugimi_programmami` | Как обмениваться с другими программами? | question | `kg01_interop` | KG01 | low |
| `concept_kak_organizovat_vneshnyuyu_dokumentaciyu_i_ee_proverku_na_korrektnost` | Как организовать внешнюю документацию и её проверку на корректность? | concept | `kg01_external_docs` | KG01 | high |
| `concept_kak_poluchit_otchuzhdaemyj_artefakt` | Как получить отчуждаемый артефакт? | question | `kg01_artifact` | KG01 | low |
| `concept_kak_proverit_bezopasnost` | Как проверить безопасность? | concept | `kg01_test_security` | KG01 | high |
| `concept_kak_proverit_v_raznyh_okruzheniyah_bd_nagruzka` | Как проверить в разных окружениях (БД, нагрузка)? | concept | `kg01_test_env` | KG01 | high |
| `concept_kak_razbit_po_fajlam` | Как разбить по файлам? | concept | `kg01_split_files` | KG01 | high |
| `concept_kak_razbit_po_modulyam` | Как разбить по модулям? | concept | `kg01_split_modules` | KG01 | high |
| `concept_kak_strukturirovat_kod` | Как структурировать код? | question | `kg01_structure` | KG01 | low |
| `concept_kak_testirovat_na_raznyh_arhitekturah_ustrojstv` | Как тестировать на разных архитектурах устройств? | concept | `kg01_test_arch` | KG01 | high |
| `concept_kak_zapuskat_kod` | Как запускать код? | question | `kg01_how_launch` | KG01 | low |
| `concept_kakimi_abstrakciyami_operiruet_kod` | Какими абстракциями оперирует код? | question | `kg02_abstractions` | KG02 | low |
| `concept_keycloak` | Keycloak | example | `kg03_keycloak` | KG03 | low |
| `concept_kibana` | Kibana | example | `kg03_kibana` | KG03 | low |
| `concept_kod` | Код | root | `kg01_root` | KG01 | low |
| `concept_kod__kg02_root` | Код | root | `kg02_root` | KG02 | low |
| `concept_konfiguracionnye_fajly_yaml_json_ini_toml` | Конфигурационные файлы (YAML, JSON, INI, TOML) | concept | `kg02_config` | KG02 | high |
| `concept_konkurentnoe_programmirovanie` | Конкурентное программирование | concept | `kg02_concurrent` | KG02 | high |
| `concept_loki` | Loki | example | `kg03_loki` | KG03 | low |
| `concept_model_upravleniya_pamyatyu` | Модель управления памятью | topic | `kg02_memory` | KG02 | high |
| `concept_na_servere_v_internete` | На сервере в интернете | concept | `kg01_remote` | KG01 | high |
| `concept_na_virtualnoj_mashine` | На виртуальной машине | concept | `kg02_virtual_machine` | KG02 | high |
| `concept_neposredstvenno_processorom_iz_mashinnogo_predstavleniya` | Непосредственно процессором из машинного представления | concept | `kg02_native` | KG02 | high |
| `concept_nestrogaya` | Нестрогая | concept | `kg02_weak` | KG02 | high |
| `concept_paradigmy_programmirovaniya` | Парадигмы программирования | topic | `kg02_paradigms` | KG02 | high |
| `concept_peremennye_okruzheniya` | Переменные окружения | concept | `kg02_envvars` | KG02 | high |
| `concept_pipeline_gitlab` | Pipeline (GitLab) | concept | `kg01_pipeline` | KG01 | high |
| `concept_pod_upravleniem_orkestratora_kubernetes` | Под управлением оркестратора (Kubernetes) | concept | `kg01_orchestrated` | KG01 | high |
| `concept_predstavleniya_koda` | Представления кода | topic | `kg02_representation` | KG02 | high |
| `concept_prilozhenie` | Приложение | root | `kg03_root` | KG03 | low |
| `concept_profilirovanie` | Профилирование | concept | `kg03_profiling` | KG03 | high |
| `concept_rabbitmq` | RabbitMQ | example | `kg03_rabbitmq` | KG03 | low |
| `concept_ruchnaya` | Ручная | concept | `kg02_manual` | KG02 | high |
| `concept_so_sborschikom_musora` | Со сборщиком мусора | concept | `kg02_gc` | KG02 | high |
| `concept_soap` | SOAP | example | `kg02_soap` | KG02 | low |
| `concept_staticheskaya` | Статическая | concept | `kg02_static` | KG02 | high |
| `concept_strogaya` | Строгая | concept | `kg02_strong` | KG02 | high |
| `concept_tipizaciya` | Типизация | topic | `kg02_typing` | KG02 | high |
| `concept_tyuring_nepolnye` | Тьюринг-неполные | concept | `kg02_incomplete` | KG02 | high |
| `concept_tyuring_polnota` | Тьюринг-полнота | topic | `kg02_turing` | KG02 | high |
| `concept_tyuring_polnye` | Тьюринг-полные | concept | `kg02_complete` | KG02 | high |
| `concept_u_razrabotchika` | У разработчика | concept | `kg01_local` | KG01 | high |
| `concept_v_izolirovannom_okruzhenii_docker` | В изолированном окружении (Docker) | concept | `kg01_isolated` | KG01 | high |
| `concept_vim` | Vim | example | `kg01_vim` | KG01 | low |
| `concept_vs_code` | VS Code | example | `kg01_vscode` | KG01 | low |
| `concept_vyzovy_bibliotek_i_funkcij` | Вызовы библиотек и функций | concept | `kg02_lib_calls` | KG02 | high |
| `concept_vyzovy_vneshnih_programm` | Вызовы внешних программ | concept | `kg02_subprocess` | KG02 | high |
| `concept_yazyki_s_algebraicheskimi_tipami_dannyh` | Языки с алгебраическими типами данных | concept | `kg02_algebraic` | KG02 | high |

**Всего пробелов: 67.**

## 5. Неопределённость чтения, влияющая на понятия

| Понятие | Открытые находки аудита |
|---|---|
| `concept_ad_fs` | ambiguous_relation |
| `concept_assembler_assembler` | low_confidence_reading, reviewer_note |
| `concept_ebpf` | ambiguous_relation |
| `concept_elasticsearch` | ambiguous_relation |
| `concept_fail_fast_restart` | reviewer_note |
| `concept_flame_graphs` | ambiguous_relation |
| `concept_framework` | ambiguous_relation, reviewer_note |
| `concept_gde_hranyat_kod` | low_confidence_reading |
| `concept_idea` | reviewer_note |
| `concept_ir_promezhutochnoe_predstavlenie` | reviewer_note |
| `concept_kafka` | ambiguous_relation |
| `concept_kak_dokumentirovat_kod_vnutri_pisat_kommentarii` | low_confidence_reading |
| `concept_kak_organizovat_vneshnyuyu_dokumentaciyu_i_ee_proverku_na_korrektnost` | low_confidence_reading |
| `concept_kak_poluchit_otchuzhdaemyj_artefakt` | low_confidence_reading |
| `concept_kak_proverit_polnotu_testirovaniya_code_coverage` | reviewer_note |
| `concept_keycloak` | ambiguous_relation |
| `concept_kibana` | ambiguous_relation, reviewer_note |
| `concept_konfiguracionnye_fajly_yaml_json_ini_toml` | low_confidence_reading |
| `concept_konkurentnoe_programmirovanie` | reviewer_note |
| `concept_loki` | ambiguous_relation |
| `concept_nestrogaya` | low_confidence_reading, reviewer_note |
| `concept_pod_upravleniem_orkestratora_kubernetes` | reviewer_note |
| `concept_rabbitmq` | ambiguous_relation |
| `concept_storage_rdbms` | reviewer_note |
| `concept_strogaya` | low_confidence_reading, reviewer_note |
| `concept_uchetnye_dannye` | ambiguous_relation, low_confidence_reading, reviewer_note |

## 6. Открытые вопросы к автору фотографий

- **Q1** — Под словом «креды» имелись в виду credentials / учётные данные?
  - Источник: TRANSCRIPTION.md — «Вопросы к автору фотографии KG-03»
- **Q2** — На листе «Postgress» или сокращённое «Postgres»; нормализация в PostgreSQL подтверждается?
  - Источник: TRANSCRIPTION.md — «Вопросы к автору фотографии KG-03»
- **Q3** — Взаимосвязи подписей с ближайшими ветками подразумеваются, но отдельные стрелки не проведены. Эти связи остаются предположениями.
  - Источник: TRANSCRIPTION.md — «Вопросы к автору фотографии KG-03»

## 7. Что этот отчёт не утверждает

- Он не утверждает, что покрытие уроками **достаточно** — только то, что оно есть и чем подтверждено.
- Он не превращает `proposed` в `verified`: без написанного урока подтверждать нечего.
- Он не утверждает, что чтение рукописи верно: спорные места вынесены в раздел 5 и в аудит.
- Он не оценивает учебную нагрузку и не измеряет время освоения.
