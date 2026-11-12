#!/usr/bin/env node
/**
 * Инструкторский набор проверок для Урока 14.
 *
 * ЗАПУСК (из корня репозитория, стандартный Node.js, без установки пакетов):
 *
 *     node --test tools/check-lesson-14.mjs
 *
 * Тест НЕ является частью ученического пути: ученику его запускать не нужно.
 * Он проверяет центральные контракты Урока 14:
 *   - канонические фрагменты (nextTask(), transitionTask(), tasks, показ)
 *     извлекаются из LESSON-14.md ОДНОЗНАЧНО (иначе тест падает с
 *     понятным сообщением);
 *   - ВСЕ ШЕСТЬ переходов таблицы Урока 13 сохранены без изменений;
 *   - nextTask() ЧИСТАЯ: не меняет вход, не зависит от глобального
 *     `tasks`, не обращается к странице, не регистрирует событий;
 *   - эквивалентные входы дают эквивалентные значения результата;
 *   - transitionTask(index, event) сохраняет СТАРЫЙ логический API
 *     (true/false), меняет ТОЛЬКО выбранный элемент массива и НЕ меняет
 *     коллекцию при отказе;
 *   - существующий интерфейс продолжает работать: принятое событие —
 *     ровно один показ, отклонённое — ни одного.
 *
 * ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ (NC-1..NC-8) ИСПОЛНЯЮТ ИСПОРЧЕННЫЕ реализации
 * и проверяют, что соответствующая проверка действительно ломается.
 * Простое отличие исходника или ссылки на объект НЕ считается нарушением:
 * каждый контроль наблюдает КОНКРЕТНОЕ нарушение своего контракта.
 *
 * НЕЗАВИСИМОЕ СРАВНЕНИЕ: для каждой из шести строк таблицы сравнивается
 * каноническая МУТИРУЮЩАЯ операция Урока 13 и чистое вычисление Урока 14
 * + намеренное обновление обёрткой. Сравниваются ПРИНЯТИЕ и ЗНАЧЕНИЯ
 * задач, а не идентичность объектов.
 *
 * ГРАНИЦЫ ДОКАЗАТЕЛЬСТВ:
 *   - JS-семантика (контракт данных) исполняется в реальном Node.js.
 *   - DOM проверяется ЧЕРЕЗ МИНИМАЛЬНУЮ ИМИТАЦИЮ: маленький document/
 *     querySelector-заглушку и счётчик вызовов показа. Это НЕ браузер,
 *     НЕ нативное выполнение и НЕ визуальная проверка.
 *   - Никакой полной имитации DOM и никакого Fake DOM-фреймворка.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Извлечение канонических фрагментов из урока
// ---------------------------------------------------------------------------

const lesson14 = readFileSync(join(ROOT, 'LESSON-14.md'), 'utf8');
const lesson13 = readFileSync(join(ROOT, 'LESSON-13.md'), 'utf8');

/**
 * Возвращает fenced-блоки кода (javascript) вместе с заголовком раздела.
 */
function fencedBlocks(markdown, language) {
  const blocks = [];
  const lines = markdown.split('\n');
  let inside = false;
  let buffer = [];
  let context = '';
  for (const line of lines) {
    if (!inside && /^#{1,6}\s/.test(line)) {
      context = line.trim();
    }
    if (!inside && line.trim() === '```' + language) {
      inside = true;
      buffer = [];
      continue;
    }
    if (inside && line.trim() === '```') {
      blocks.push({ context, code: buffer.join('\n') });
      inside = false;
      continue;
    }
    if (inside) {
      buffer.push(line);
    }
  }
  if (inside) {
    throw new Error('Найден незакрытый блок ```' + language);
  }
  return blocks;
}

/**
 * Находит ЕДИНСТВЕННЫЙ блок кода по предикату. Ноль или больше одного —
 * понятная ошибка (тест падает, а не выбирает произвольный блок).
 */
function uniqueBlock(blocks, predicate, description) {
  const found = blocks.filter(predicate);
  if (found.length === 0) {
    throw new Error('В LESSON-14.md не найден блок: ' + description);
  }
  if (found.length > 1) {
    throw new Error(
      'В LESSON-14.md блок неоднозначен: ' + description +
      ' (найдено ' + found.length + ' подходящих блоков: ' +
      found.map((b) => b.context).join(' | ') + ')'
    );
  }
  return found[0].code;
}

const jsBlocks = fencedBlocks(lesson14, 'javascript');

// Каноническая ЧИСТАЯ функция: ровно один блок с `function nextTask(task, event)`.
const nextTaskSource = uniqueBlock(
  jsBlocks,
  (block) => /^function nextTask\(task, event\)\s*\{/m.test(block.code),
  'каноническая функция nextTask(task, event)'
);

// Каноническая ОБЁРТКА. В уроке показаны ДВЕ версии transitionTask():
// старая (мутирующая, из Урока 13) — для сравнения — и новая (обёртка).
// Берём новую: она содержит вызов nextTask().
const transitionTaskBlocks = jsBlocks.filter((block) =>
  /^function transitionTask\(index, event\)\s*\{/m.test(block.code)
);
const wrapperBlocks = transitionTaskBlocks.filter((block) =>
  block.code.includes('nextTask(')
);
if (wrapperBlocks.length !== 1) {
  throw new Error(
    'В LESSON-14.md должен быть ровно один блок transitionTask(index, event), ' +
    'вызывающий nextTask(); найдено ' + wrapperBlocks.length +
    ' (всего блоков transitionTask: ' + transitionTaskBlocks.length + ')'
  );
}
const transitionTaskSource = wrapperBlocks[0].code;

// Канонический массив tasks из Урока 13 (используется как модель данных).
const tasksLiteralSource = uniqueBlock(
  fencedBlocks(lesson13, 'javascript'),
  (block) => /^const tasks = \[/m.test(block.code),
  'канонический массив tasks (Урок 13)'
);

// Канонический показ списка из Урока 13.
const renderTaskListSource = uniqueBlock(
  fencedBlocks(lesson13, 'javascript'),
  (block) =>
    block.code.includes("document.createElement('li')") &&
    block.code.includes('task.status'),
  'канонический фрагмент показа списка задач (Урок 13)'
);

// Каноническая функция completeSelectedTask() из Урока 13.
const completeSelectedTaskSource = uniqueBlock(
  fencedBlocks(lesson13, 'javascript'),
  (block) => /^function completeSelectedTask\(\)\s*\{/m.test(block.code),
  'каноническая функция completeSelectedTask() (Урок 13)'
);

// ---------------------------------------------------------------------------
// Сборка исполняемого приложения
// ---------------------------------------------------------------------------

/**
 * Минимальная имитация document: нужен только querySelector по id,
 * createElement и appendChild. Никакого layout, никакого CSS,
 * никакого настоящего рендеринга.
 *
 * ГРАНИЦА: заглушка НЕ регистрирует обработчики и НЕ диспетчеризует
 * click (как и заглушки в наборах Уроков 11–13).
 */
function makeFakeDocument() {
  const registry = new Map();
  const errors = [];

  function makeElement(id) {
    const children = [];
    let text = '';

    const element = {
      id: String(id).replace('#', ''),
      children,
      get textContent() {
        return text;
      },
      set textContent(value) {
        text = String(value);
        if (text === '') {
          children.length = 0;
        }
      },
      appendChild(child) {
        children.push(child);
        return child;
      },
      classList: {
        toggle() {
          return false;
        },
        contains() {
          return false;
        }
      },
      addEventListener() {},
      click() {}
    };

    return element;
  }

  for (const id of [
    '#task-list',
    '#task-count',
    '#task-choice',
    '#complete-selected-task'
  ]) {
    registry.set(id, makeElement(id));
  }

  const consoleStub = {
    log: () => {},
    error: (message) => errors.push(String(message)),
    warn: () => {}
  };

  const document = {
    registry,
    body: makeElement('body'),
    querySelector(selector) {
      if (typeof selector !== 'string' || !selector.startsWith('#')) {
        return null;
      }
      return registry.get(selector) || null;
    },
    createElement(tagName) {
      return makeElement('#' + String(tagName));
    }
  };

  return { document, registry, errors, consoleStub };
}

/**
 * Собирает приложение из канонических фрагментов.
 *
 * Любой фрагмент можно подменить, чтобы получить испорченную реализацию
 * для отрицательного контроля.
 */
function buildApp(options = {}) {
  const {
    tasksLiteral = tasksLiteralSource,
    nextSource = nextTaskSource,
    transitionSource = transitionTaskSource,
    completeSource = completeSelectedTaskSource,
    renderSource = renderTaskListSource,
    extraSource = ''
  } = options;

  const page = makeFakeDocument();
  const renderCalls = [];

  const RENDER_SOURCE = `
function renderTaskList() {
  renderCalls.push('renderTaskList');
  const list = document.querySelector('#task-list');

  if (!list) {
    return;
  }

  const count = document.querySelector('#task-count');

  if (count) {
    count.textContent = String(tasks.length);
  }

  list.textContent = '';

${renderSource}
}
`;

  const factory = new Function(
    'document',
    'console',
    'renderCalls',
    `
${tasksLiteral}

${nextSource}

${transitionSource}

${completeSource}

${RENDER_SOURCE}

${extraSource}

return {
  tasks,
  nextTask,
  transitionTask,
  completeSelectedTask,
  renderTaskList,
  get renderCalls() { return renderCalls; }
};`
  );

  const api = factory(page.document, page.consoleStub, renderCalls);

  return { page, api, tasks: api.tasks, renderCalls, errors: page.errors };
}

/**
 * НЕЗАВИСИМЫЙ снимок состояния задач.
 * Ожидания НЕ выводятся из проверяемой реализации: снимок строится из
 * ЗНАЧЕНИЙ, а сравнение идёт с независимо заданными ожиданиями.
 */
function snapshot(tasks) {
  return {
    count: tasks.length,
    titles: tasks.map((t) => t.title),
    statuses: tasks.map((t) => t.status)
  };
}

/**
 * Таблица переходов — источник истины для тестов.
 * Ожидания заданы НЕЗАВИСИМО от проверяемой реализации.
 * ЭТА ТАБЛИЦА ДОЛЖНА СОВПАДАТЬ с таблицей Урока 13 (см. P-TABLE-1).
 */
const TRANSITION_TABLE = [
  { from: 'new', event: 'START', to: 'in_progress', accepted: true },
  { from: 'new', event: 'COMPLETE', to: 'new', accepted: false },
  { from: 'in_progress', event: 'START', to: 'in_progress', accepted: false },
  { from: 'in_progress', event: 'COMPLETE', to: 'done', accepted: true },
  { from: 'done', event: 'START', to: 'done', accepted: false },
  { from: 'done', event: 'COMPLETE', to: 'done', accepted: true }
];

/** Инвариант состояния: у каждой задачи `status` — одно из трёх. */
const VALID_STATUSES = ['new', 'in_progress', 'done'];

function invariantHolds(tasks) {
  return tasks.every((t) => VALID_STATUSES.includes(t.status));
}

/** Сравнение задач ПО ЗНАЧЕНИЯМ (не по ссылкам). */
function taskValues(task) {
  return { title: task.title, status: task.status };
}

// ---------------------------------------------------------------------------
// СТАТИЧЕСКИЕ ПРОВЕРКИ ТЕКСТА УРОКА
// ---------------------------------------------------------------------------

test('урок содержит канонические фрагменты', () => {
  // nextTask(): чистая функция.
  assert.match(nextTaskSource, /function nextTask\(task, event\)/);
  assert.match(nextTaskSource, /accepted: true/);
  assert.match(nextTaskSource, /accepted: false/);
  assert.match(nextTaskSource, /task: \{ title: task\.title, status:/);
  assert.match(nextTaskSource, /return \{/);

  // Чистая функция НЕ обращается к странице, к глобальному массиву и
  // НЕ регистрирует события.
  assert.doesNotMatch(nextTaskSource, /document\./, 'чистая функция не обращается к странице');
  assert.doesNotMatch(nextTaskSource, /window\./, 'чистая функция не обращается к window');
  assert.doesNotMatch(nextTaskSource, /console\./, 'чистая функция не пишет в консоль');
  assert.doesNotMatch(nextTaskSource, /\btasks\b/, 'чистая функция не зависит от массива tasks');
  assert.doesNotMatch(nextTaskSource, /addEventListener/, 'чистая функция не регистрирует событий');
  assert.doesNotMatch(nextTaskSource, /fetch\(|XMLHttpRequest|localStorage/, 'чистая функция не делает ввод-вывод');

  // transitionTask(): тонкая обёртка.
  assert.match(transitionTaskSource, /function transitionTask\(index, event\)/);
  assert.match(transitionTaskSource, /Number\.isInteger\(index\)/);
  assert.match(transitionTaskSource, /index < 0 \|\| index >= tasks\.length/);
  assert.match(transitionTaskSource, /nextTask\(/, 'обёртка вызывает чистую функцию');
  assert.match(transitionTaskSource, /result\.accepted/, 'обёртка проверяет признак принятия');
  assert.match(transitionTaskSource, /tasks\[index\] = result\.task;/, 'обёртка кладёт результат в массив');
  assert.match(transitionTaskSource, /return true;/);
  assert.match(transitionTaskSource, /return false;/);

  // В обёртке НЕ должно быть правил переходов: никаких сравнений со
  // состояниями и никаких присваиваний status.
  assert.doesNotMatch(
    transitionTaskSource,
    /status ===/,
    'обёртка не содержит правил переходов'
  );
  assert.doesNotMatch(
    transitionTaskSource,
    /\.status\s*=/,
    'обёртка не присваивает status'
  );
  assert.doesNotMatch(
    transitionTaskSource,
    /document\./,
    'обёртка не обращается к странице'
  );
  assert.doesNotMatch(
    transitionTaskSource,
    /renderTaskList/,
    'обёртка не показывает список'
  );
});

test('P-TABLE-1: таблица переходов Урока 14 совпадает с таблицей Урока 13', () => {
  // Таблица из LESSON-14.md: четыре колонки (состояние, событие, результат,
  // принято) — как в Уроке 13.
  const rows = lesson14
    .split('\n')
    .filter((line) =>
      /^\| `(new|in_progress|done)` \| `(START|COMPLETE)` \| [^|]+ \| `(true|false)` \|$/.test(line)
    );
  assert.equal(rows.length, 6, 'в LESSON-14.md ровно шесть строк таблицы переходов');

  for (const row of TRANSITION_TABLE) {
    assert.match(
      lesson14,
      new RegExp('`' + row.from + '`\\s*\\|\\s*`' + row.event + '`\\s*\\|'),
      'в уроке есть строка: ' + row.from + ' + ' + row.event
    );
  }

  // И таблица Урока 13 не изменилась — её строки по-прежнему на месте.
  const rows13 = lesson13
    .split('\n')
    .filter((line) =>
      /^\| `(new|in_progress|done)` \| `(START|COMPLETE)` \| [^|]+ \| `(true|false)` \|$/.test(line)
    );
  assert.equal(rows13.length, 6, 'в LESSON-13.md по-прежнему шесть строк таблицы переходов');
});

test('P-TABLE-2: в уроке сказано, что правила не изменились', () => {
  assert.match(
    lesson14,
    /не меняем|не изменилось|без изменений/i,
    'сказано, что таблица переходов не меняется'
  );
  assert.match(
    lesson14,
    /одна таблица переходов/i,
    'указано, что таблица переходов остаётся одной'
  );
});

test('DOC-1: урок различает вычисление и изменение состояния', () => {
  assert.match(
    lesson14,
    /Входные данные → вычисление → новые данные/,
    'приведена главная модель вычисления'
  );
  assert.match(
    lesson14,
    /Событие интерфейса → вычисление → изменение состояния приложения → отображение/,
    'приведена полная цепочка приложения'
  );
  assert.match(
    lesson14,
    /не\*\* значит, что приложение перестаёт менять состояние|не означают\*\*, что приложение перестаёт менять состояние/i,
    'сказано, что чистые функции не отменяют изменение состояния'
  );
});

test('DOC-2: сказано, что функция, возвращающая значение, ещё не обязана быть чистой', () => {
  assert.match(
    lesson14,
    /что-то \*\*возвращает\*\*, ещё \*\*не обязана\*\* быть чистой/i,
    'есть тема «возвращает значение — ещё не значит чистая»'
  );
  assert.match(
    lesson14,
    /чистота — это не правильность|Правильность не значит/i,
    'сказано: чистота не значит правильность'
  );
  assert.match(
    lesson14,
    /Правильность не значит «чисто»/,
    'приведён второй half формулы'
  );
});

test('DOC-3: эквивалентность значений, а не идентичность объектов', () => {
  assert.match(
    lesson14,
    /одинаковые входные значения → одинаковые значения результата|одинаковые входы → одинаковые значения/i,
    'сказано про эквивалентные входы и эквивалентные значения результата'
  );
  assert.match(
    lesson14,
    /разные\*\* объекты|это \*\*разные\*\* объекты/i,
    'сказано, что объекты, созданные двумя вызовами, РАЗНЫЕ'
  );
  assert.doesNotMatch(
    lesson14,
    /first\.task === second\.task/,
    'не сравниваются объекты по ссылке'
  );
});

test('DOC-4: урок не вводит запрещённые понятия', () => {
  const forbidden = [
    'spread',
    'структурного разделения',
    'глубокого клонирования',
    'персистентных коллекций',
    'рекурсии',
    'TypeScript',
    'class ',
    'reducer',
    'редьюсер',
    'dispatch(',
    'React',
    'реактивн'
  ];

  // Понятия из запрещённого списка могут быть НАЗВАНЫ — но только
  // В ОТРИЦАТЕЛЬНОМ контексте: урок явно говорит, что их НЕ вводит.
  // Поэтому проверяем не само упоминание, а его контекст:
  //   - упоминание стоит рядом с «не используем / не вводим / не нужно»;
  //   - в ИСПОЛНЯЕМОМ коде урока этих понятий нет вовсе.
  const lines = lesson14.split('\n');
  for (const word of forbidden) {
    const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    for (const line of lines) {
      if (!pattern.test(line)) {
        continue;
      }
      assert.match(
        line,
        /не вводит|не используем|не нужен|не нужн|ни |не применяем|не применяются|не используются/i,
        'понятие «' + word + '» упоминается только в отрицательном контексте: ' +
        line.trim().slice(0, 120)
      );
    }
  }

  // Spread-оператор в коде урока не используется.
  for (const block of jsBlocks) {
    assert.doesNotMatch(block.code, /\.\.\./, 'в коде урока нет spread-оператора');
  }
});

test('DOC-5: урок требует предсказаний ДО исполнения кода', () => {
  const predictStart = lesson14.indexOf('## Шаг 1. Predict');
  const runStart = lesson14.indexOf('## Шаг 2. Run');
  assert.ok(predictStart >= 0, 'есть раздел «Шаг 1. Predict»');
  assert.ok(runStart >= 0, 'есть раздел «Шаг 2. Run»');

  const predictSection = lesson14.slice(predictStart, runStart);

  // В шаге Predict нет РЕАЛИЗАЦИИ новой функции. Допустим только
  // короткий ИЛЛЮСТРАТИВНЫЙ пример (четыре строки) и показ старой
  // функции Урока 13 — для сравнения.
  const predictJs = fencedBlocks(predictSection, 'javascript');
  for (const block of predictJs) {
    assert.doesNotMatch(
      block.code,
      /^function nextTask\(/m,
      'в шаге Predict нет реализации чистой функции'
    );
    assert.doesNotMatch(
      block.code,
      /accepted: true/,
      'в шаге Predict нет реализации чистой функции'
    );
    assert.doesNotMatch(
      block.code,
      /tasks\[index\] = result\.task/,
      'в шаге Predict нет реализации обёртки'
    );
  }
  assert.match(
    predictSection,
    /Запишите предсказания ДО запуска/i,
    'требование записать предсказания есть'
  );
});

test('DOC-6: в уроке порядок PRIMM: Predict → Run → Investigate → Modify → Make', () => {
  const predict = lesson14.indexOf('## Шаг 1. Predict');
  const run = lesson14.indexOf('## Шаг 2. Run');
  const investigate = lesson14.indexOf('## Шаг 3. Investigate');
  const modify = lesson14.indexOf('## Шаг 4. Modify');
  const make = lesson14.indexOf('## Шаг 5. Make');

  for (const [name, pos] of [
    ['Predict', predict],
    ['Run', run],
    ['Investigate', investigate],
    ['Modify', modify],
    ['Make', make]
  ]) {
    assert.ok(pos >= 0, 'есть раздел «' + name + '»');
  }

  assert.ok(predict < run, 'Predict идёт перед Run');
  assert.ok(run < investigate, 'Run идёт перед Investigate');
  assert.ok(investigate < modify, 'Investigate идёт перед Modify');
  assert.ok(modify < make, 'Modify идёт перед Make');
});

test('DOC-7: Make остаётся необязательным и не требует реализации', () => {
  const makeSection = lesson14.slice(lesson14.indexOf('## Шаг 5. Make'));
  assert.match(makeSection, /необязательн/i, 'шаг Make помечен необязательным');
  assert.match(makeSection, /Не пишите код/i, 'сказано, что код писать не нужно');
  assert.match(
    lesson14,
    /не является условием для Урока 15/i,
    'сказано, что Make не является условием для следующего урока'
  );
});

test('DOC-8: оценка времени указана явно', () => {
  assert.match(
    lesson14,
    /\*\*Время:\*\* 45–75 минут \(оценка\)/,
    'время указано и помечено как оценка'
  );
  assert.match(
    lesson14,
    /\*\*Пререквизиты:\*\*/,
    'пререквизиты указаны'
  );
  assert.match(
    lesson14,
    /practice\/lesson-01\/index\.html/,
    'указан тот же проект practice/lesson-01/index.html'
  );
});

// ---------------------------------------------------------------------------
// ПОЛОЖИТЕЛЬНЫЕ ПРОВЕРКИ: ЧИСТАЯ ФУНКЦИЯ
// ---------------------------------------------------------------------------

test('P1: все шесть переходов дают результат таблицы', () => {
  const { api } = buildApp();

  for (const row of TRANSITION_TABLE) {
    const input = { title: 'Задача', status: row.from };
    const result = api.nextTask(input, row.event);

    assert.equal(
      result.accepted,
      row.accepted,
      'принятие для ' + row.from + ' + ' + row.event
    );
    assert.equal(
      result.task.status,
      row.to,
      'итоговое состояние для ' + row.from + ' + ' + row.event
    );
  }
});

test('P2: принятые переходы возвращают true-признак, отклонённые — false', () => {
  const { api } = buildApp();

  const accepted = api.nextTask({ title: 'А', status: 'new' }, 'START');
  assert.equal(accepted.accepted, true, 'принятый переход даёт accepted === true');
  assert.equal(typeof accepted.accepted, 'boolean', 'accepted — логическое значение');

  const rejected = api.nextTask({ title: 'А', status: 'new' }, 'COMPLETE');
  assert.equal(rejected.accepted, false, 'отклонённый переход даёт accepted === false');
  assert.equal(typeof rejected.accepted, 'boolean', 'accepted — логическое значение');
});

test('P3: принятый идемпотентный переход (done + COMPLETE) сохранён', () => {
  const { api } = buildApp();

  const result = api.nextTask({ title: 'А', status: 'done' }, 'COMPLETE');

  assert.equal(result.accepted, true, 'событие принято');
  assert.equal(result.task.status, 'done', 'состояние осталось done');
  assert.equal(result.task.title, 'А', 'название сохранено');
});

test('P4: чистая функция НЕ изменяет переданный объект', () => {
  const { api } = buildApp();

  for (const row of TRANSITION_TABLE) {
    const input = { title: 'Задача', status: row.from };
    const before = { title: input.title, status: input.status };

    api.nextTask(input, row.event);

    assert.deepEqual(
      taskValues(input),
      before,
      'вход не изменился для ' + row.from + ' + ' + row.event
    );
  }
});

test('P5: возвращается правильный НОВЫЙ объект с правильными значениями', () => {
  const { api } = buildApp();

  const input = { title: 'Прочитать главу', status: 'new' };
  const result = api.nextTask(input, 'START');

  assert.deepEqual(
    taskValues(result.task),
    { title: 'Прочитать главу', status: 'in_progress' },
    'новый объект содержит правильные значения'
  );
  assert.notEqual(
    result.task,
    input,
    'результат — НОВЫЙ объект, а не тот же самый'
  );
});

test('P6: название задачи сохраняется во всех шести переходах', () => {
  const { api } = buildApp();

  for (const row of TRANSITION_TABLE) {
    const result = api.nextTask({ title: 'Моё название', status: row.from }, row.event);
    assert.equal(
      result.task.title,
      'Моё название',
      'название сохранено для ' + row.from + ' + ' + row.event
    );
  }
});

test('P7: эквивалентные входы дают эквивалентные значения результата', () => {
  const { api } = buildApp();

  for (const row of TRANSITION_TABLE) {
    const first = api.nextTask({ title: 'А', status: row.from }, row.event);
    const second = api.nextTask({ title: 'А', status: row.from }, row.event);

    assert.equal(
      first.accepted,
      second.accepted,
      'accepted совпадает для ' + row.from + ' + ' + row.event
    );
    assert.deepEqual(
      taskValues(first.task),
      taskValues(second.task),
      'значения результата совпадают для ' + row.from + ' + ' + row.event
    );
  }
});

test('P8: чистая функция не зависит от глобального массива tasks', () => {
  // Проверяем ИСПОЛНЕНИЕМ: тот же вход даёт тот же результат, когда
  // глобальный массив tasks меняется под ногами.
  const { api, tasks } = buildApp();

  const before = api.nextTask({ title: 'А', status: 'new' }, 'START');

  tasks[0].status = 'done';
  tasks[1].status = 'done';
  tasks[2].status = 'done';

  const after = api.nextTask({ title: 'А', status: 'new' }, 'START');

  assert.equal(before.accepted, after.accepted, 'accepted не зависит от глобального tasks');
  assert.deepEqual(
    taskValues(before.task),
    taskValues(after.task),
    'значения результата не зависят от глобального tasks'
  );
  assert.doesNotMatch(
    nextTaskSource,
    /\btasks\b/,
    'в исходнике чистой функции нет упоминания tasks'
  );
});

test('P9: неизвестное событие отклоняется', () => {
  const { api } = buildApp();

  const result = api.nextTask({ title: 'А', status: 'new' }, 'REOPEN');

  assert.equal(result.accepted, false, 'неизвестное событие отклонено');
  assert.equal(result.task.status, 'new', 'состояние прежнее');
  assert.equal(result.task.title, 'А', 'название прежнее');
});

test('P10: неизвестное состояние отклоняется', () => {
  const { api } = buildApp();

  const result = api.nextTask({ title: 'А', status: 'mystery' }, 'START');

  assert.equal(result.accepted, false, 'неизвестное состояние отклонено');
  assert.equal(result.task.status, 'mystery', 'состояние прежнее');
});

// ---------------------------------------------------------------------------
// ПОЛОЖИТЕЛЬНЫЕ ПРОВЕРКИ: ОБЁРТКА
// ---------------------------------------------------------------------------

test('P11: обёртка сохраняет старый логический API', () => {
  const { api } = buildApp();

  assert.equal(api.transitionTask(1, 'COMPLETE'), true, 'принятое событие даёт true');
  assert.equal(api.transitionTask(0, 'COMPLETE'), false, 'отклонённое событие даёт false');
  assert.equal(api.transitionTask(-1, 'COMPLETE'), false, 'неверный номер даёт false');
  assert.equal(api.transitionTask(99, 'COMPLETE'), false, 'выход за границы даёт false');
  assert.equal(api.transitionTask(1.5, 'COMPLETE'), false, 'дробный номер даёт false');
  assert.equal(api.transitionTask('1', 'COMPLETE'), false, 'строковый номер даёт false');
  assert.equal(api.transitionTask(NaN, 'COMPLETE'), false, 'NaN даёт false');
});

test('P12: обёртка меняет ТОЛЬКО выбранный элемент массива', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  api.transitionTask(1, 'COMPLETE');
  const after = snapshot(tasks);

  assert.equal(after.count, before.count, 'количество задач прежнее');
  assert.deepEqual(after.titles, before.titles, 'названия прежние');
  assert.equal(after.statuses[0], before.statuses[0], 'первая задача прежняя');
  assert.equal(after.statuses[1], 'done', 'выбранная задача стала done');
  assert.equal(after.statuses[2], before.statuses[2], 'третья задача прежняя');
  assert.equal(invariantHolds(tasks), true, 'инвариант состояния выполняется');
});

test('P13: отклонённое событие сохраняет коллекцию ПОЛНОСТЬЮ', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  const result = api.transitionTask(0, 'COMPLETE');
  const after = snapshot(tasks);

  assert.equal(result, false, 'событие отклонено');
  assert.deepEqual(after, before, 'коллекция не изменилась полностью');
  assert.deepEqual(
    tasks[0],
    { title: 'Прочитать главу', status: 'new' },
    'выбранная задача тоже не изменилась'
  );
});

test('P14: посторонние задачи, названия и количество остаются прежними', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  api.transitionTask(2, 'COMPLETE');
  const after = snapshot(tasks);

  assert.equal(after.count, before.count, 'количество прежнее');
  assert.deepEqual(after.titles, before.titles, 'названия прежние');
  assert.equal(after.statuses[0], 'new', 'первая задача прежняя');
  assert.equal(after.statuses[1], 'in_progress', 'вторая задача прежняя');
  assert.equal(after.statuses[2], 'done', 'третья задача прежняя (идемпотентный принятый переход)');
});

test('P15: принятое событие через интерфейс показывает список РОВНО ОДИН раз', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  api.completeSelectedTask();

  assert.equal(renderCalls.length, 1, 'ровно один показ');
  assert.equal(tasks[1].status, 'done', 'выбранная задача завершена');
  assert.equal(tasks[0].status, 'new', 'первая задача не тронута');
  assert.equal(tasks[2].status, 'done', 'третья задача не тронута');
});

test('P16: отклонённое событие через интерфейс НЕ показывает список', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 0;

  api.completeSelectedTask();

  assert.equal(renderCalls.length, 0, 'ни одного показа');
  assert.deepEqual(
    snapshot(tasks),
    {
      count: 3,
      titles: ['Прочитать главу', 'Сделать упражнение', 'Проверить результат'],
      statuses: ['new', 'in_progress', 'done']
    },
    'коллекция не изменилась'
  );
  assert.equal(page.errors.length, 1, 'в консоль ушло сообщение об отказе');
});

test('P17: счётчик, сообщение, оформление и выбор остались вне расчёта', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  api.completeSelectedTask();

  // Количество задач на странице — прежнее.
  const count = page.registry.get('#task-count');
  assert.equal(count.textContent, '3', 'счётчик задач прежний');

  // Список выбора остался связан с порядком массива.
  assert.equal(
    select.selectedIndex,
    1,
    'выбор не сбросился после перехода'
  );

  // Названия в списке соответствуют состояниям.
  const items = page.registry.get('#task-list').children.map((item) => item.textContent);
  assert.deepEqual(
    items,
    [
      'Прочитать главу — Новая',
      'Сделать упражнение — Выполнена',
      'Проверить результат — Выполнена'
    ],
    'подписи соответствуют состояниям'
  );

  // Ни счётчик кликов, ни сообщение, ни тема не затронуты расчётом.
  assert.equal(renderCalls.length, 1, 'показ ровно один');
  assert.equal(tasks.length, 3, 'коллекция прежней длины');
});

test('P18: чистая функция не меняет приложение — вызов сам по себе ничего не делает', () => {
  const { api, tasks, renderCalls } = buildApp();

  const before = snapshot(tasks);
  const result = api.nextTask({ title: 'А', status: 'new' }, 'START');

  assert.equal(result.accepted, true, 'решение получено');
  assert.deepEqual(snapshot(tasks), before, 'приложение не изменилось');
  assert.equal(renderCalls.length, 0, 'ни одного показа');
});

// ---------------------------------------------------------------------------
// НЕЗАВИСИМОЕ СРАВНЕНИЕ С МУТИРУЮЩЕЙ ОПЕРАЦИЕЙ УРОКА 13
// ---------------------------------------------------------------------------

/**
 * Каноническая МУТИРУЮЩАЯ операция Урока 13 — эталон сравнения.
 * Берётся из самого LESSON-13.md, а не пишется здесь заново.
 */
const mutatingTransitionSource = uniqueBlock(
  fencedBlocks(lesson13, 'javascript'),
  (block) => /^function transitionTask\(index, event\)\s*\{/m.test(block.code),
  'каноническая мутирующая функция transitionTask(index, event) (Урок 13)'
);

/**
 * Строит приложение с МУТИРУЮЩЕЙ реализацией Урока 13.
 * `tasksLiteral` можно подменить, чтобы задать изолированный вход.
 */
function buildMutatingApp(tasksLiteral) {
  const page = makeFakeDocument();
  const renderCalls = [];

  const factory = new Function(
    'document',
    'console',
    'renderCalls',
    `
${tasksLiteral || tasksLiteralSource}

${mutatingTransitionSource}

return {
  tasks,
  transitionTask,
  get renderCalls() { return renderCalls; }
};`
  );

  const api = factory(page.document, page.consoleStub, renderCalls);

  return { api, tasks: api.tasks };
}

test('EQ-1: чистое вычисление + обёртка дают ТОТ ЖЕ результат, что мутирующая операция Урока 13', () => {
  const pure = buildApp();

  for (const row of TRANSITION_TABLE) {
    // Мутирующая операция Урока 13 — на изолированном входе.
    const mutating = buildMutatingApp(
      "const tasks = [{ title: 'Задача', status: '" + row.from + "' }, " +
      "{ title: 'Другая', status: 'new' }];"
    );
    const mutatingAccepted = mutating.api.transitionTask(0, row.event);
    const mutatingFinal = mutating.tasks[0];

    // Чистое вычисление Урока 14 + намеренное обновление обёрткой.
    const pureTasks = [
      { title: 'Задача', status: row.from },
      { title: 'Другая', status: 'new' }
    ];
    const decision = pure.api.nextTask(pureTasks[0], row.event);
    let pureAccepted = false;
    if (decision.accepted) {
      pureTasks[0] = decision.task;
      pureAccepted = true;
    }
    const pureFinal = pureTasks[0];

    assert.equal(
      pureAccepted,
      mutatingAccepted,
      'принятие совпадает для ' + row.from + ' + ' + row.event
    );
    assert.equal(
      mutatingAccepted,
      row.accepted,
      'эталон Урока 13 совпадает с таблицей: ' + row.from + ' + ' + row.event
    );
    assert.deepEqual(
      taskValues(pureFinal),
      taskValues(mutatingFinal),
      'итоговые значения совпадают для ' + row.from + ' + ' + row.event
    );
    assert.deepEqual(
      taskValues(mutatingFinal),
      { title: 'Задача', status: row.to },
      'эталон даёт состояние из таблицы: ' + row.from + ' + ' + row.event
    );
  }
});

test('EQ-2: посторонние задачи одинаковы у обоих способов', () => {
  const LITERAL =
    "const tasks = [{ title: 'Прочитать главу', status: 'new' }, " +
    "{ title: 'Сделать упражнение', status: 'in_progress' }, " +
    "{ title: 'Проверить результат', status: 'done' }];";

  const mutating = buildMutatingApp(LITERAL);
  mutating.api.transitionTask(1, 'COMPLETE');

  const pure = buildApp({ tasksLiteral: LITERAL });
  const decision = pure.api.nextTask(pure.tasks[1], 'COMPLETE');
  if (decision.accepted) {
    pure.tasks[1] = decision.task;
  }

  assert.deepEqual(
    pure.tasks.map(taskValues),
    mutating.tasks.map(taskValues),
    'полные коллекции совпадают по значениям'
  );
  assert.deepEqual(
    pure.tasks.map(taskValues),
    [
      { title: 'Прочитать главу', status: 'new' },
      { title: 'Сделать упражнение', status: 'done' },
      { title: 'Проверить результат', status: 'done' }
    ],
    'обе коллекции содержат ожидаемые значения'
  );
});

// ---------------------------------------------------------------------------
// ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ
//
// Каждый контроль ИСПОЛНЯЕТ испорченную реализацию и наблюдает
// КОНКРЕТНОЕ нарушение своего контракта. Отличие исходника или ссылки
// на объект НЕ считается нарушением.
// ---------------------------------------------------------------------------

test('NC-1: чистая функция, изменяющая свой вход, нарушает контракт чистоты', () => {
  // Испорченная реализация: функция ПРИСВАИВАЕТ статус переданному
  // объекту вместо создания нового.
  const broken = nextTaskSource.replace(
    /return \{\n      accepted: true,\n      task: \{ title: task\.title, status: 'in_progress' \}\n    \};/,
    "task.status = 'in_progress';\n    return {\n      accepted: true,\n      task: { title: task.title, status: task.status }\n    };"
  );

  assert.notEqual(broken, nextTaskSource, 'испорченная реализация действительно отличается');
  assert.match(broken, /task\.status = 'in_progress';/, 'присваивание добавлено');

  const { api } = buildApp({ nextSource: broken });

  const input = { title: 'А', status: 'new' };
  const result = api.nextTask(input, 'START');

  // КОНКРЕТНОЕ нарушение: входной объект ИЗМЕНЁН.
  assert.equal(
    input.status,
    'in_progress',
    'входной объект изменён — контракт чистоты нарушен'
  );
  assert.notEqual(
    input.status,
    'new',
    'исходное состояние НЕ сохранилось'
  );

  // Контроль на ложное срабатывание: эталонная реализация вход не меняет.
  const { api: goodApi } = buildApp();
  const goodInput = { title: 'А', status: 'new' };
  goodApi.nextTask(goodInput, 'START');
  assert.equal(goodInput.status, 'new', 'эталонная реализация вход не меняет');
});

test('NC-2: функция, читающая внешний изменяемый tasks, нарушает независимость', () => {
  // Испорченная реализация: решение принимается не по аргументу,
  // а по глобальному массиву tasks.
  const broken = nextTaskSource.replace(
    /if \(task\.status === 'new' && event === 'START'\) \{/,
    "if (tasks[0].status === 'new' && event === 'START') {"
  );

  assert.notEqual(broken, nextTaskSource, 'испорченная реализация действительно отличается');
  assert.match(broken, /tasks\[0\]\.status/, 'чтение глобального массива добавлено');

  const { api, tasks } = buildApp({ nextSource: broken });

  // Первый вызов: глобальный tasks[0] — 'new'.
  const first = api.nextTask({ title: 'А', status: 'done' }, 'START');
  assert.equal(first.accepted, true, 'при глобальном new решение принято');

  // Меняем глобальное состояние — и результат меняется, хотя ВХОД тот же.
  tasks[0].status = 'done';

  const second = api.nextTask({ title: 'А', status: 'done' }, 'START');

  assert.notEqual(
    second.accepted,
    first.accepted,
    'при одинаковом входе результат изменился — функция зависит от внешнего состояния'
  );
  assert.equal(second.accepted, false, 'после смены глобального состояния решение отклонено');
});

test('NC-3: функция, возвращающая неверное следующее состояние, нарушает таблицу', () => {
  // Испорченная реализация: new + COMPLETE принимается (как в Уроке 13).
  const broken = nextTaskSource.replace(
    /if \(task\.status === 'new' && event === 'START'\) \{/,
    "if (task.status === 'new' && event === 'COMPLETE') {\n    return {\n      accepted: true,\n      task: { title: task.title, status: 'done' }\n    };\n  }\n\n  if (task.status === 'new' && event === 'START') {"
  );

  assert.notEqual(broken, nextTaskSource, 'испорченная реализация действительно отличается');

  const { api } = buildApp({ nextSource: broken });

  const result = api.nextTask({ title: 'А', status: 'new' }, 'COMPLETE');

  // КОНКРЕТНОЕ нарушение: таблица переходов нарушена.
  assert.equal(result.accepted, true, 'функция ошибочно приняла запрещённый переход');
  assert.notEqual(result.accepted, false, 'контракт таблицы переходов нарушен');
  assert.equal(result.task.status, 'done', 'состояние изменено в обход таблицы');

  // При этом функция остаётся ЧИСТОЙ — контракт чистоты не нарушен.
  const input = { title: 'А', status: 'new' };
  api.nextTask(input, 'COMPLETE');
  assert.equal(input.status, 'new', 'функция по-прежнему не меняет вход');

  // Контроль на ложное срабатывание: эталон отклоняет.
  const { api: goodApi } = buildApp();
  assert.equal(
    goodApi.nextTask({ title: 'А', status: 'new' }, 'COMPLETE').accepted,
    false,
    'эталонная реализация отклоняет new + COMPLETE'
  );
});

test('NC-4: обёртка, меняющая не ту задачу, нарушает границу допустимых изменений', () => {
  // Испорченная реализация: обёртка кладёт результат не в выбранную
  // ячейку, а в первую.
  const broken = transitionTaskSource.replace(
    /tasks\[index\] = result\.task;/,
    'tasks[0] = result.task;'
  );

  assert.notEqual(broken, transitionTaskSource, 'испорченная реализация действительно отличается');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  api.transitionTask(1, 'COMPLETE');
  const after = snapshot(tasks);

  // КОНКРЕТНОЕ нарушение: изменена НЕ выбранная задача.
  assert.equal(after.statuses[0], 'done', 'изменена первая задача вместо выбранной');
  assert.equal(after.statuses[1], before.statuses[1], 'выбранная задача НЕ изменена');
  assert.notDeepEqual(after.statuses, before.statuses, 'состояния изменились не там');
});

test('NC-5: отклонённое событие, меняющее состояние, нарушает контракт отказа', () => {
  // Испорченная реализация: обёртка меняет данные даже при отказе.
  const broken = transitionTaskSource.replace(
    /if \(!result\.accepted\) \{\n    return false;\n  \}/,
    "if (!result.accepted) {\n    tasks[0].status = 'done';\n    return false;\n  }"
  );

  assert.notEqual(broken, transitionTaskSource, 'испорченная реализация действительно отличается');
  assert.match(broken, /tasks\[0\]\.status = 'done';/, 'мутация при отказе добавлена');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  const result = api.transitionTask(0, 'COMPLETE');
  const after = snapshot(tasks);

  // КОНКРЕТНОЕ нарушение: при отказе данные изменились.
  assert.equal(result, false, 'функция отказала');
  assert.equal(after.statuses[0], 'done', 'задача изменилась, хотя отказ не имеет права ничего менять');
  assert.notDeepEqual(after, before, 'коллекция изменилась при отказе');

  // Контроль на ложное срабатывание: эталон при отказе ничего не меняет.
  const { api: goodApi, tasks: goodTasks } = buildApp();
  const goodBefore = snapshot(goodTasks);
  goodApi.transitionTask(0, 'COMPLETE');
  assert.deepEqual(snapshot(goodTasks), goodBefore, 'эталонная реализация коллекцию не меняет');
});

test('NC-6: обёртка, отклоняющая идемпотентный переход, нарушает таблицу', () => {
  // Испорченная реализация: обёртка считает «принятым» только переход,
  // который реально что-то меняет, и отклоняет done + COMPLETE.
  const broken = transitionTaskSource.replace(
    /if \(!result\.accepted\) \{\n    return false;\n  \}/,
    "if (!result.accepted || result.task.status === 'done' && tasks[index].status === 'done') {\n    return false;\n  }"
  );

  assert.notEqual(broken, transitionTaskSource, 'испорченная реализация действительно отличается');

  const { api, tasks } = buildApp({
    transitionSource: broken,
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', status: 'new' }, " +
      "{ title: 'Сделать упражнение', status: 'in_progress' }, " +
      "{ title: 'Проверить результат', status: 'done' }];"
  });

  const before = snapshot(tasks);
  const result = api.transitionTask(2, 'COMPLETE');
  const after = snapshot(tasks);

  // КОНКРЕТНОЕ нарушение: принятый идемпотентный переход отклонён.
  assert.equal(result, false, 'идемпотентный принятый переход ошибочно отклонён');
  assert.notEqual(result, true, 'контракт таблицы переходов нарушен');
  assert.deepEqual(after, before, 'состояние прежнее');

  // Контроль на ложное срабатывание: эталон принимает done + COMPLETE.
  const { api: goodApi } = buildApp();
  assert.equal(
    goodApi.transitionTask(2, 'COMPLETE'),
    true,
    'эталонная реализация принимает done + COMPLETE'
  );
});

test('NC-7: обёртка, забывающая применить результат, нарушает постусловие', () => {
  // Испорченная реализация: решение получено, но в массив не положено.
  const broken = transitionTaskSource.replace(
    /tasks\[index\] = result\.task;/,
    '/* результат не применён */'
  );

  assert.notEqual(broken, transitionTaskSource, 'испорченная реализация действительно отличается');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  const result = api.transitionTask(1, 'COMPLETE');
  const after = snapshot(tasks);

  // КОНКРЕТНОЕ нарушение: функция сказала «принято», а состояние прежнее.
  assert.equal(result, true, 'функция отчиталась об успехе');
  assert.equal(after.statuses[1], 'in_progress', 'состояние выбранной задачи НЕ изменилось');
  assert.notEqual(after.statuses[1], 'done', 'постусловие нарушено');
  assert.deepEqual(after, before, 'коллекция осталась прежней');

  // Контроль на ложное срабатывание: эталон применяет результат.
  const { api: goodApi, tasks: goodTasks } = buildApp();
  goodApi.transitionTask(1, 'COMPLETE');
  assert.equal(goodTasks[1].status, 'done', 'эталонная реализация применяет результат');
});

test('NC-8: функция, теряющая название задачи, нарушает контракт результата', () => {
  // Испорченная реализация: название задачи не копируется.
  const broken = nextTaskSource.replace(
    /task: \{ title: task\.title, status: 'in_progress' \}/,
    "task: { title: '', status: 'in_progress' }"
  );

  assert.notEqual(broken, nextTaskSource, 'испорченная реализация действительно отличается');
  assert.match(broken, /title: ''/, 'название действительно потеряно');

  const { api } = buildApp({ nextSource: broken });

  const result = api.nextTask({ title: 'Прочитать главу', status: 'new' }, 'START');

  // КОНКРЕТНОЕ нарушение: название потеряно.
  assert.equal(result.task.title, '', 'название задачи потеряно');
  assert.notEqual(result.task.title, 'Прочитать главу', 'контракт «название сохраняется» нарушен');
  assert.equal(result.task.status, 'in_progress', 'состояние при этом правильное');

  // Контроль на ложное срабатывание: эталон сохраняет название.
  const { api: goodApi } = buildApp();
  assert.equal(
    goodApi.nextTask({ title: 'Прочитать главу', status: 'new' }, 'START').task.title,
    'Прочитать главу',
    'эталонная реализация сохраняет название'
  );
});
