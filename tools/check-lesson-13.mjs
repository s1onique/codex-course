#!/usr/bin/env node
/**
 * Инструкторский набор проверок для Урока 13.
 *
 * ЗАПУСК (из корня репозитория, стандартный Node.js, без установки пакетов):
 *
 *     node --test tools/check-lesson-13.mjs
 *
 * Тест НЕ является частью ученического пути: ученику его запускать не нужно.
 * Он проверяет центральные контракты Урока 13:
 *   - каноническая функция transitionTask(index, event) извлекается из
 *     LESSON-13.md ОДНОЗНАЧНО (иначе тест падает с понятным сообщением);
 *   - ВСЕ ШЕСТЬ комбинаций «состояние + событие» дают результат,
 *     указанный в таблице переходов;
 *   - принятые переходы меняют ТОЛЬКО выбранную задачу;
 *   - идемпотентный принятый переход (done + COMPLETE) сохраняет состояние;
 *   - отклонённые переходы возвращают false и НЕ мутируют коллекцию;
 *   - недопустимые индексы, недопустимые события и неизвестные состояния
 *     отклоняются без мутации;
 *   - количество задач, названия и порядок не меняются;
 *   - инвариант состояния («status — одно из трёх») выполняется после
 *     каждого принятого перехода;
 *   - показ использует `status`, а не устаревшее поле `done`;
 *   - существующий интерфейс (список выбора, кнопка, счётчик, сообщение,
 *     оформление) продолжает работать.
 *
 * ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ (NC-1..NC-7) ИСПОЛНЯЮТ ИСПОРЧЕННЫЕ реализации
 * и проверяют, что соответствующая проверка действительно ломается.
 *
 * ГРАНИЦЫ ДОКАЗАТЕЛЬСТВ:
 *   - JS-семантика (контракт данных) исполняется в реальном Node.js.
 *   - DOM проверяется ЧЕРЕЗ МИНИМАЛЬНУЮ ИМИТАЦИЮ: маленький document/
 *     querySelector-заглушку и счётчик вызовов показа. Это НЕ браузер,
 *     НЕ нативное выполнение и НЕ визуальная проверка.
 *   - Число обработчиков и тема покрываются постоянным набором Урока 11.
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

const jsBlocks = fencedBlocks(lesson13, 'javascript');

/**
 * Находит ЕДИНСТВЕННЫЙ блок кода по предикату. Ноль или больше одного —
 * понятная ошибка (тест падает, а не выбирает произвольный блок).
 */
function uniqueBlock(blocks, predicate, description) {
  const found = blocks.filter(predicate);
  if (found.length === 0) {
    throw new Error(
      'В LESSON-13.md не найден блок: ' + description
    );
  }
  if (found.length > 1) {
    throw new Error(
      'В LESSON-13.md блок неоднозначен: ' + description +
      ' (найдено ' + found.length + ' подходящих блоков: ' +
      found.map((b) => b.context).join(' | ') + ')'
    );
  }
  return found[0].code;
}

const transitionTaskSource = uniqueBlock(
  jsBlocks,
  (block) => /^function transitionTask\(index, event\)\s*\{/m.test(block.code),
  'каноническая функция transitionTask(index, event)'
);

const completeSelectedTaskSource = uniqueBlock(
  jsBlocks,
  (block) => /^function completeSelectedTask\(\)\s*\{/m.test(block.code),
  'каноническая функция completeSelectedTask()'
);

const tasksLiteralSource = uniqueBlock(
  jsBlocks,
  (block) => /^const tasks = \[/m.test(block.code),
  'канонический массив tasks'
);

const renderTaskListSource = uniqueBlock(
  jsBlocks,
  (block) =>
    block.code.includes("document.createElement('li')") &&
    block.code.includes('task.status'),
  'канонический фрагмент показа списка задач'
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
 * click (как и заглушка в наборе Урока 12). Покрытие событий — в
 * постоянном наборе Урока 11.
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
 * Собирает приложение из канонических фрагментов LESSON-13.md.
 *
 * Любой фрагмент можно подменить, чтобы получить испорченную реализацию
 * для отрицательного контроля.
 *
 * `renderCalls` — счётчик вызовов показа списка.
 */
function buildApp(options = {}) {
  const {
    tasksLiteral = tasksLiteralSource,
    transitionSource = transitionTaskSource,
    completeSource = completeSelectedTaskSource,
    renderSource = renderTaskListSource
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

${transitionSource}

${completeSource}

${RENDER_SOURCE}

return {
  tasks,
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
 * Ожидаемые значения НЕ выводятся из проверяемой реализации: снимок
 * строится из ЗНАЧЕНИЙ, а сравнение идёт с независимо заданными ожиданиями.
 */
function snapshot(tasks) {
  return {
    count: tasks.length,
    titles: tasks.map((t) => t.title),
    statuses: tasks.map((t) => t.status)
  };
}

/** Три задачи в трёх состояниях — ожидания заданы НЕЗАВИСИМО. */
const EXPECTED_INITIAL = {
  count: 3,
  titles: ['Прочитать главу', 'Сделать упражнение', 'Проверить результат'],
  statuses: ['new', 'in_progress', 'done']
};

/** Инвариант состояния: у каждой задачи `status` — одно из трёх. */
const VALID_STATUSES = ['new', 'in_progress', 'done'];

function invariantHolds(tasks) {
  return tasks.every((t) => VALID_STATUSES.includes(t.status));
}

/**
 * Таблица переходов — источник истины для тестов.
 * Ожидания заданы НЕЗАВИСИМО от проверяемой реализации.
 */
const TRANSITION_TABLE = [
  { from: 'new', event: 'START', to: 'in_progress', accepted: true },
  { from: 'new', event: 'COMPLETE', to: null, accepted: false },
  { from: 'in_progress', event: 'START', to: null, accepted: false },
  { from: 'in_progress', event: 'COMPLETE', to: 'done', accepted: true },
  { from: 'done', event: 'START', to: null, accepted: false },
  { from: 'done', event: 'COMPLETE', to: 'done', accepted: true }
];

// ---------------------------------------------------------------------------
// СТАТИЧЕСКИЕ ПРОВЕРКИ ТЕКСТА УРОКА
// ---------------------------------------------------------------------------

test('урок содержит канонические фрагменты', () => {
  // transitionTask(): операция данных, без обращения к странице.
  assert.match(transitionTaskSource, /function transitionTask\(index, event\)/);
  assert.match(transitionTaskSource, /Number\.isInteger\(index\)/);
  assert.match(transitionTaskSource, /index < 0 \|\| index >= tasks\.length/);
  assert.match(transitionTaskSource, /task\.status === 'new' && event === 'START'/);
  assert.match(
    transitionTaskSource,
    /task\.status === 'in_progress' && event === 'COMPLETE'/
  );
  assert.match(transitionTaskSource, /task\.status === 'done' && event === 'COMPLETE'/);
  assert.match(transitionTaskSource, /return true;/);
  assert.match(transitionTaskSource, /return false;/);
  assert.doesNotMatch(
    transitionTaskSource,
    /document\./,
    'операция перехода не обращается к странице'
  );
  assert.doesNotMatch(
    transitionTaskSource,
    /renderTaskList/,
    'операция перехода не показывает список'
  );

  // completeSelectedTask(): связь с интерфейсом, вызывает transitionTask().
  assert.match(completeSelectedTaskSource, /function completeSelectedTask\(\)/);
  assert.match(completeSelectedTaskSource, /#task-choice/);
  assert.match(
    completeSelectedTaskSource,
    /transitionTask\(select\.selectedIndex, 'COMPLETE'\)/
  );
  assert.match(completeSelectedTaskSource, /renderTaskList\(\);/);
});

test('таблица переходов в уроке содержит все шесть строк', () => {
  // Каждая строка таблицы урока должна быть в тексте.
  for (const row of TRANSITION_TABLE) {
    assert.match(
      lesson13,
      new RegExp(
        '`' + row.from + '`\\s*\\|\\s*`' + row.event + '`\\s*\\|'
      ),
      'в уроке есть строка таблицы: ' + row.from + ' + ' + row.event
    );
  }

  // Шесть строк — по одной на каждое сочетание. Считаем строки ИМЕННО
  // канонической таблицы (у неё четыре колонки: состояние, событие,
  // результат, принято), а не таблицы наблюдения из шага Investigate.
  const rows = lesson13
    .split('\n')
    .filter((line) =>
      /^\| `(new|in_progress|done)` \| `(START|COMPLETE)` \| [^|]+ \| `(true|false)` \|$/.test(line)
    );
  assert.equal(rows.length, 6, 'в канонической таблице ровно шесть строк переходов');
});

test('урок различает принятый переход без изменения и отклонённый переход', () => {
  assert.match(
    lesson13,
    /`true` теперь означает[^\n]*«событие принято»/,
    'сказано, что true означает «событие принято»'
  );
  assert.match(
    lesson13,
    /Отклонённый переход и принятый/i,
    'явно разведены отказ и принятый «вхолостую» переход'
  );
  assert.match(
    lesson13,
    /идемпотент/i,
    'названа идемпотентность принятого перехода'
  );
});


test('урок требует предсказаний ДО исполнения кода', () => {
  const predictStart = lesson13.indexOf('## Шаг 1. Predict');
  const runStart = lesson13.indexOf('## Шаг 2. Run');
  assert.ok(predictStart >= 0, 'в LESSON-13.md есть раздел «Шаг 1. Predict»');
  assert.ok(runStart >= 0, 'в LESSON-13.md есть раздел «Шаг 2. Run»');

  const predictSection = lesson13.slice(predictStart, runStart);

  const predictJs = fencedBlocks(predictSection, 'javascript');
  assert.equal(
    predictJs.length,
    0,
    'в шаге Predict не должно быть ни одного исполняемого блока javascript'
  );
  assert.match(
    predictSection,
    /Запишите предсказания ДО запуска/i,
    'требование записать предсказания есть'
  );
  assert.match(
    predictSection,
    /Таблица переходов/i,
    'таблица переходов записана в шаге Predict, до реализации'
  );
});

test('в уроке порядок PRIMM: Predict → Run → Investigate → Modify → Make', () => {
  const predict = lesson13.indexOf('## Шаг 1. Predict');
  const run = lesson13.indexOf('## Шаг 2. Run');
  const investigate = lesson13.indexOf('## Шаг 3. Investigate');
  const modify = lesson13.indexOf('## Шаг 4. Modify');
  const make = lesson13.indexOf('## Шаг 5. Make');

  for (const [name, pos] of [
    ['Predict', predict],
    ['Run', run],
    ['Investigate', investigate],
    ['Modify', modify],
    ['Make', make]
  ]) {
    assert.ok(pos >= 0, 'в LESSON-13.md есть раздел «' + name + '»');
  }

  assert.ok(predict < run, 'Predict идёт перед Run');
  assert.ok(run < investigate, 'Run идёт перед Investigate');
  assert.ok(investigate < modify, 'Investigate идёт перед Modify');
  assert.ok(modify < make, 'Modify идёт перед Make');
});

test('CONS-1: обязательные консольные проверки используют только знакомые конструкции', () => {
  // ИСТОРИЧЕСКАЯ ПОПРАВКА (ACT-15, 12.11.2026).
  //
  // Прежний обязательный путь ученика вводил новые конструкции, которых
  // в курсе ещё не было: Array.map(), Array.every(), Array.includes() и
  // стрелочные функции. Теперь используются только уже знакомые:
  // обращение к элементу по номеру и цикл for...of.
  const checksStart = lesson13.indexOf('### Первые исполняемые проверки');
  const checksEnd = lesson13.indexOf('### Таблица наблюдения');
  assert.ok(checksStart >= 0, 'найден раздел «Первые исполняемые проверки»');
  assert.ok(checksEnd > checksStart, 'найден раздел «Таблица наблюдения»');

  const section = lesson13.slice(checksStart, checksEnd);
  const blocks = fencedBlocks(section, 'javascript');
  assert.ok(blocks.length > 0, 'в разделе есть исполняемый блок');

  for (const block of blocks) {
    assert.doesNotMatch(
      block.code,
      /\.map\s*\(/,
      'в обязательном пути нет Array.map()'
    );
    assert.doesNotMatch(
      block.code,
      /\.every\s*\(/,
      'в обязательном пути нет Array.every()'
    );
    assert.doesNotMatch(
      block.code,
      /\.includes\s*\(/,
      'в обязательном пути нет Array.includes()'
    );
    assert.doesNotMatch(
      block.code,
      /=>/,
      'в обязательном пути нет стрелочных функций'
    );
  }

  // Знакомые конструкции, на которых построена проверка, — присутствуют.
  const code = blocks.map((b) => b.code).join('\n');
  assert.match(code, /for \(const task of tasks\)/, 'использован уже знакомый for...of');
  assert.match(code, /tasks\[0\]\.status/, 'использовано обращение к элементу по номеру');
  assert.match(code, /console\.assert\(/, 'использован console.assert()');
});

test('CONS-2: контракт показа описан как «принято — показ, отказ — без показа»', () => {
  // ИСТОРИЧЕСКАЯ ПОПРАВКА (ACT-15, 12.11.2026). Прежняя формулировка
  // «показ только тогда, когда данные действительно изменились» была
  // НЕВЕРНА: принятый идемпотентный переход (done + COMPLETE) меняет
  // данные, но по принятому событию показ всё равно происходит.
  assert.doesNotMatch(
    lesson13,
    /только тогда, когда данные действительно изменились/i,
    'прежняя неверная формулировка убрана'
  );
  assert.match(
    lesson13,
    /принятое событие — показ один раз, отказ — без показа/i,
    'сказано: принятое событие — показ один раз, отказ — без показа'
  );
});

test('CONS-3: таблица упражнения REOPEN содержит ровно ТРИ строки', () => {
  // ИСТОРИЧЕСКАЯ ПОПРАВКА (ACT-15, 12.11.2026). Прежний текст говорил,
  // что в таблице REOPEN «должно быть все шесть строк», хотя в ней
  // ровно три комбинации «состояние + REOPEN».
  const makeStart = lesson13.indexOf('## Шаг 5. Make');
  assert.ok(makeStart >= 0, 'найден раздел «Шаг 5. Make»');
  const makeSection = lesson13.slice(makeStart);

  const rows = makeSection
    .split('\n')
    .filter((line) => /^\| `(new|in_progress|done)` \| `REOPEN` \|/.test(line));
  assert.equal(rows.length, 3, 'в таблице REOPEN ровно три строки');

  assert.match(
    makeSection,
    /все \*\*три\*\* строки|\*\*все три\*\* строки|все три строки/,
    'текст называет три строки, а не шесть'
  );
  assert.doesNotMatch(
    makeSection,
    /все шесть строк/,
    'прежнее «все шесть строк» убрано'
  );
});

test('CONS-4: сказано, что одна кнопка не проверяет все шесть переходов', () => {
  // ИСТОРИЧЕСКАЯ ПОПРАВКА (ACT-15, 12.11.2026). Прежний текст намекал,
  // что все шесть комбинаций проверяются нажатием кнопки, хотя кнопка
  // отправляет только событие COMPLETE.
  assert.match(
    lesson13,
    /Одна кнопка — не все шесть строк/,
    'сказано, что одна кнопка не покрывает все шесть строк'
  );
  assert.match(
    lesson13,
    /только\*\* строки с `COMPLETE`|только строки с `COMPLETE`/,
    'сказано, что кнопка проверяет только строки с COMPLETE'
  );

  // И объяснено, как задать известное начальное состояние.
  assert.match(
    lesson13,
    /задайте\*\* состояние|задать известное начальное состояние/i,
    'объяснено, как установить известное начальное состояние'
  );
  assert.match(
    lesson13,
    /tasks\[0\]\.status = 'new';/,
    'показан пример установки состояния обычным присваиванием'
  );
});

test('CONS-5: консольные проверки начинаются с известного состояния', () => {
  // ИСТОРИЧЕСКАЯ ПОПРАВКА (ACT-15, 12.11.2026). Если предыдущее
  // нажатие уже перевело tasks[1] в done, ученик проверял бы НЕ ТУ
  // строку таблицы. Требуется явное указание.
  const checksStart = lesson13.indexOf('### Первые исполняемые проверки');
  const checksEnd = lesson13.indexOf('### Таблица наблюдения');
  const section = lesson13.slice(checksStart, checksEnd);

  assert.match(
    section,
    /известное начальное состояние/i,
    'сказано, что сначала нужно известное начальное состояние'
  );
  assert.match(
    section,
    /обновите страницу|F5/i,
    'сказано, что страницу нужно обновить'
  );

  // Состояние «до» запоминается ДО вызова перехода.
  const code = fencedBlocks(section, 'javascript')
    .map((b) => b.code)
    .join('\n');
  const beforeIndex = code.indexOf('const beforeFirst');
  const callIndex = code.indexOf('transitionTask(1');
  assert.ok(beforeIndex >= 0, 'состояние «до» запоминается');
  assert.ok(callIndex >= 0, 'переход вызывается');
  assert.ok(
    beforeIndex < callIndex,
    'состояние «до» запоминается ДО вызова перехода'
  );

  // Проверки инварианта, постусловия и границы сохранены.
  assert.match(code, /accepted === true/, 'проверка постусловия «событие принято» сохранена');
  assert.match(code, /tasks\[1\]\.status === 'done'/, 'проверка постусловия «стало done» сохранена');
  assert.match(code, /beforeFirst/, 'проверка границы допустимых изменений сохранена');
  assert.match(code, /for \(const task of tasks\)/, 'проверка инварианта сохранена');
});

test('Make остаётся необязательным', () => {
  assert.match(lesson13, /Шаг 5\. Make[\s\S]*?необязательн/i, 'шаг Make помечен необязательным');
});

test('урок не вводит запрещённые понятия', () => {
  const forbidden = [
    'switch',
    'enum',
    'TypeScript',
    'interface ',
    'extends ',
    'class ',
    'reducer',
    'dispatch(',
    'State pattern',
    'localStorage',
    'sessionStorage',
    'async ',
    'await ',
    'Promise',
    'require(',
    'import '
  ];
  const codeOnly = jsBlocks.map((b) => b.code).join('\n');
  for (const token of forbidden) {
    assert.ok(
      !codeOnly.includes(token),
      'в каноническом коде Урока 13 не должно быть: ' + token
    );
  }

  // Запрещённые понятия не вводятся и в тексте урока.
  assert.doesNotMatch(
    lesson13,
    /вложенн\w* состояни/i,
    'вложенные состояния не вводятся'
  );
  assert.doesNotMatch(
    lesson13,
    /параллельн\w* состояни/i,
    'параллельные состояния не вводятся'
  );
  assert.doesNotMatch(
    lesson13,
    /очеред\w* событий/i,
    'очереди событий не вводятся'
  );
});

test('урок не требует от ученика Node.js и тестовых библиотек', () => {
  const nodeMentions = lesson13
    .split('\n')
    .filter((line) => /Node\.js|node:test|node:assert/.test(line));
  for (const line of nodeMentions) {
    assert.ok(
      /не нужен|не понадобится|не требуется|не входит|отдельная вещь|ни Node\.js/i.test(line),
      'Node.js упоминается только как необязательный: ' + line
    );
  }

  assert.doesNotMatch(
    lesson13,
    /npm install|npm i |установите пакет/i,
    'урок не предлагает установку пакетов'
  );
});

test('урок не заявляет, что таблица переходов — это доказательство', () => {
  assert.match(
    lesson13,
    /Тест — это ещё не доказательство/i,
    'явно сказано, что проверка — не доказательство'
  );
  assert.match(
    lesson13,
    /console\.assert\(\)/,
    'разобрано, что именно делает console.assert()'
  );
  assert.match(
    lesson13,
    /не останавливает/i,
    'сказано, что console.assert() не останавливает программу'
  );
});

test('урок явно называет изменение контракта завершения задачи', () => {
  // Требование акта: изменение поведения должно быть ЗАЯВЛЕНО, а не спрятано.
  assert.match(
    lesson13,
    /Это не поломка и не откат/i,
    'явно сказано, что новое правило — намеренное'
  );
  assert.match(
    lesson13,
    /намеренно новое требование/i,
    'изменение контракта названо намеренным'
  );
});

// ---------------------------------------------------------------------------
// ПОЗИТИВНЫЕ ПРОВЕРКИ: ТАБЛИЦА ПЕРЕХОДОВ
// ---------------------------------------------------------------------------

test('P1: все шесть сочетаний «состояние + событие» дают результат таблицы', () => {
  // Для каждой строки таблицы готовим задачу в нужном состоянии и
  // применяем событие. Ожидания берутся из НЕЗАВИСИМОЙ таблицы выше.
  for (const row of TRANSITION_TABLE) {
    const { api, tasks } = buildApp({
      tasksLiteral:
        "const tasks = [{ title: 'Прочитать главу', status: '" + row.from +
        "' }, { title: 'Сделать упражнение', status: '" + row.from +
        "' }, { title: 'Проверить результат', status: '" + row.from + "' }];"
    });

    const result = api.transitionTask(0, row.event);

    assert.equal(
      result,
      row.accepted,
      'состояние ' + row.from + ' + ' + row.event + ': ожидался принят=' +
      row.accepted
    );

    if (row.accepted && row.to !== null) {
      assert.equal(
        tasks[0].status,
        row.to,
        'состояние ' + row.from + ' + ' + row.event + ': ожидался результат ' +
        row.to
      );
    } else {
      assert.equal(
        tasks[0].status,
        row.from,
        'состояние ' + row.from + ' + ' + row.event +
        ': состояние должно остаться прежним'
      );
    }
  }
});

test('P2: принятые переходы меняют ТОЛЬКО выбранную задачу', () => {
  const cases = [
    { index: 0, from: 'new', event: 'START', to: 'in_progress' },
    { index: 1, from: 'in_progress', event: 'COMPLETE', to: 'done' },
    { index: 2, from: 'done', event: 'COMPLETE', to: 'done' }
  ];

  for (const c of cases) {
    const { api, tasks } = buildApp({
      tasksLiteral:
        "const tasks = [{ title: 'Прочитать главу', status: '" + c.from +
        "' }, { title: 'Сделать упражнение', status: '" + c.from +
        "' }, { title: 'Проверить результат', status: '" + c.from + "' }];"
    });

    const before = snapshot(tasks);
    const result = api.transitionTask(c.index, c.event);
    const after = snapshot(tasks);

    assert.equal(result, true, 'переход принят');
    assert.equal(after.statuses[c.index], c.to, 'выбранная задача перешла в ' + c.to);

    for (let i = 0; i < before.statuses.length; i += 1) {
      if (i === c.index) {
        continue;
      }
      assert.equal(
        after.statuses[i],
        before.statuses[i],
        'задача ' + i + ' не должна была измениться'
      );
    }
  }
});

test('P3: идемпотентный принятый переход (done + COMPLETE) сохраняет состояние', () => {
  const { api, tasks } = buildApp({
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', status: 'done' }, " +
      "{ title: 'Сделать упражнение', status: 'done' }, " +
      "{ title: 'Проверить результат', status: 'done' }];"
  });

  const before = snapshot(tasks);

  const result = api.transitionTask(2, 'COMPLETE');

  assert.equal(result, true, 'событие ПРИНЯТО');
  assert.equal(tasks[2].status, 'done', 'состояние осталось done');
  assert.deepEqual(
    snapshot(tasks),
    before,
    'ни одно значение не изменилось'
  );
});

test('P4: отклонённые переходы возвращают false', () => {
  const rejected = TRANSITION_TABLE.filter((row) => !row.accepted);

  for (const row of rejected) {
    const { api } = buildApp({
      tasksLiteral:
        "const tasks = [{ title: 'Прочитать главу', status: '" + row.from +
        "' }, { title: 'Сделать упражнение', status: '" + row.from +
        "' }, { title: 'Проверить результат', status: '" + row.from + "' }];"
    });

    const result = api.transitionTask(0, row.event);

    assert.equal(
      result,
      false,
      'состояние ' + row.from + ' + ' + row.event + ' должно быть отклонено'
    );
  }
});

test('P5: отклонённые переходы НЕ мутируют коллекцию', () => {
  const rejected = TRANSITION_TABLE.filter((row) => !row.accepted);

  for (const row of rejected) {
    const { api, tasks } = buildApp({
      tasksLiteral:
        "const tasks = [{ title: 'Прочитать главу', status: '" + row.from +
        "' }, { title: 'Сделать упражнение', status: '" + row.from +
        "' }, { title: 'Проверить результат', status: '" + row.from + "' }];"
    });

    const before = snapshot(tasks);
    api.transitionTask(0, row.event);
    const after = snapshot(tasks);

    assert.deepEqual(
      after,
      before,
      'состояние ' + row.from + ' + ' + row.event + ': коллекция не изменилась'
    );
  }
});

test('P6: недопустимые индексы отклоняются', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);

  for (const bad of [-1, -5, 3, 99, 1.5, NaN, '1', '', null, undefined, true]) {
    const result = api.transitionTask(bad, 'COMPLETE');
    assert.equal(result, false, 'индекс ' + String(bad) + ' отклонён');
  }

  assert.deepEqual(snapshot(tasks), before, 'ни одна задача не изменилась');
});

test('P7: недопустимые события отклоняются', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);

  for (const bad of ['', 'start', 'complete', 'REOPEN', 'FINISH', 'start ', null, undefined, 42, {}]) {
    const result = api.transitionTask(0, bad);
    assert.equal(result, false, 'событие ' + String(bad) + ' отклонено');
  }

  assert.deepEqual(snapshot(tasks), before, 'ни одна задача не изменилась');
});

test('P8: неизвестное текущее состояние отклоняется без мутации', () => {
  const { api, tasks } = buildApp({
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', status: 'mystery' }, " +
      "{ title: 'Сделать упражнение', status: 'in_progress' }, " +
      "{ title: 'Проверить результат', status: 'done' }];"
  });

  const before = snapshot(tasks);

  const resultStart = api.transitionTask(0, 'START');
  const resultComplete = api.transitionTask(0, 'COMPLETE');

  assert.equal(resultStart, false, 'START из неизвестного состояния отклонён');
  assert.equal(resultComplete, false, 'COMPLETE из неизвестного состояния отклонён');
  assert.deepEqual(snapshot(tasks), before, 'коллекция не изменилась');
});

test('P9: количество задач не меняется', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);

  api.transitionTask(0, 'START');
  api.transitionTask(1, 'COMPLETE');
  api.transitionTask(2, 'COMPLETE');
  api.transitionTask(0, 'COMPLETE');
  api.transitionTask(99, 'START');

  const after = snapshot(tasks);

  assert.equal(after.count, before.count, 'количество прежнее');
  assert.equal(after.count, EXPECTED_INITIAL.count, 'количество равно 3');
  assert.equal(tasks.length, 3, 'в массиве по-прежнему три задачи');
});

test('P10: названия и порядок задач не меняются', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);

  api.transitionTask(0, 'START');
  api.transitionTask(1, 'COMPLETE');
  api.transitionTask(2, 'COMPLETE');

  const after = snapshot(tasks);

  assert.deepEqual(after.titles, before.titles, 'названия прежние');
  assert.deepEqual(
    after.titles,
    EXPECTED_INITIAL.titles,
    'названия совпадают с независимо заданными ожиданиями'
  );
});

test('P11: состояния НЕвыбранных задач не меняются', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);

  api.transitionTask(1, 'COMPLETE');

  const after = snapshot(tasks);

  assert.equal(after.statuses[0], before.statuses[0], 'состояние первой прежнее');
  assert.equal(after.statuses[2], before.statuses[2], 'состояние третьей прежнее');
  assert.equal(after.statuses[1], 'done', 'изменилась только выбранная');
});

test('P12: инвариант состояния выполняется после каждого принятого перехода', () => {
  const { api, tasks } = buildApp();

  assert.equal(invariantHolds(tasks), true, 'инвариант верен до операций');

  api.transitionTask(0, 'START');
  assert.equal(invariantHolds(tasks), true, 'инвариант после new + START');

  api.transitionTask(1, 'COMPLETE');
  assert.equal(invariantHolds(tasks), true, 'инвариант после in_progress + COMPLETE');

  api.transitionTask(2, 'COMPLETE');
  assert.equal(invariantHolds(tasks), true, 'инвариант после done + COMPLETE');

  // Задача остаётся РОВНО в одном состоянии — статус всегда строка.
  for (const task of tasks) {
    assert.equal(typeof task.status, 'string', 'status — строка');
  }
});

test('P13: исходные данные мигрированы — поля `done` в tasks нет', () => {
  const { api, tasks } = buildApp();

  assert.deepEqual(
    tasks.map((t) => t.status),
    EXPECTED_INITIAL.statuses,
    'три задачи в трёх состояниях'
  );

  for (const task of tasks) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(task, 'done'),
      false,
      'у задачи нет собственного поля `done`'
    );
    assert.equal(task.done, undefined, 'чтение task.done даёт undefined');
  }

  // В исходном тексте массива `tasks` нет поля `done` как СВОЙСТВА.
  // Строка `status: 'done'` — это ЗНАЧЕНИЕ состояния, а не поле.
  assert.doesNotMatch(
    tasksLiteralSource,
    /\bdone:\s*(true|false)/,
    'в каноническом массиве tasks нет свойства done'
  );
  assert.doesNotMatch(
    tasksLiteralSource,
    /\bdone:\s*'/,
    'в каноническом массиве tasks нет строкового свойства done'
  );
});

test('P13b: показ использует `status`, а не устаревшее поле `done`', () => {
  // ПРОВЕРКА ИСХОДНИКА (статическая): в каноническом фрагменте показа
  // читается `task.status`, а `task.done` не читается.
  assert.match(renderTaskListSource, /task\.status/, 'показ читает task.status');
  assert.doesNotMatch(
    renderTaskListSource,
    /task\.done/,
    'показ НЕ читает устаревшее поле task.done'
  );

  // ПРОВЕРКА ИСПОЛНЕНИЕМ: собранное приложение показывает три подписи.
  const { api, page } = buildApp();
  api.renderTaskList();

  const list = page.registry.get('#task-list');
  const shown = list.children.map((item) => item.textContent);

  assert.equal(shown.length, 3, 'показаны три пункта');
  assert.equal(shown[0], 'Прочитать главу — Новая', 'первая — Новая');
  assert.equal(shown[1], 'Сделать упражнение — В работе', 'вторая — В работе');
  assert.equal(shown[2], 'Проверить результат — Выполнена', 'третья — Выполнена');
});

test('P14: список выбора остаётся связанным с порядком массива', () => {
  // ПРОВЕРКА ИСХОДНИКА: renderTaskChoices() не менялась — она строит
  // варианты из task.title и по-прежнему идёт по массиву в том же порядке.
  assert.match(
    lesson13,
    /`renderTaskChoices\(\)` \*\*не меняется\*\*/,
    'урок говорит, что renderTaskChoices() не меняется'
  );

  // ПРОВЕРКА ИСПОЛНЕНИЕМ: собираем варианты из данных тем же циклом,
  // что и в Уроке 11, и сверяем порядок с порядком массива.
  const { tasks } = buildApp();

  const options = tasks.map((task) => task.title);

  assert.deepEqual(
    options,
    EXPECTED_INITIAL.titles,
    'порядок вариантов совпадает с порядком задач'
  );
  assert.equal(
    options[1],
    'Сделать упражнение',
    'второй вариант — вторая задача (in_progress)'
  );
  assert.equal(
    tasks[1].status,
    'in_progress',
    'вторая задача — та, что в состоянии in_progress'
  );
});

test('P15: принятое завершение через интерфейс показывает список РОВНО ОДИН раз', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  api.completeSelectedTask();

  assert.equal(renderCalls.length, 1, 'один вызов — один показ');
  assert.equal(tasks[1].status, 'done', 'выбранная (вторая) задача завершена');
  assert.equal(tasks[0].status, 'new', 'первая задача не тронута');
  assert.equal(tasks[2].status, 'done', 'третья задача не тронута');
});

test('P16: отклонённое завершение через интерфейс НЕ меняет состояние и НЕ показывает список', () => {
  const { api, tasks, renderCalls, page, errors } = buildApp();

  const select = page.registry.get('#task-choice');
  // Первая задача — в состоянии `new`: COMPLETE отклоняется.
  select.selectedIndex = 0;

  const before = snapshot(tasks);

  api.completeSelectedTask();

  assert.equal(renderCalls.length, 0, 'на отказе список НЕ показывается');
  assert.deepEqual(snapshot(tasks), before, 'состояние не изменилось');
  assert.equal(tasks[0].status, 'new', 'первая задача осталась new');

  // На отказе должно быть ПОНЯТНОЕ сообщение про состояние.
  assert.ok(
    errors.length > 0,
    'на отказе записано сообщение в консоль'
  );
  assert.match(
    errors.join(' | '),
    /переход/i,
    'сообщение говорит про переход, а не про «задачу не выбрана»'
  );
});

test('P17: счётчик, количество, сообщение и оформление не затронуты переходом', () => {
  // ПРОВЕРКА ИСПОЛНЕНИЕМ на представительном сценарии: принятый переход
  // не меняет количество задач и не ломает счётчик на странице.
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  api.completeSelectedTask();

  // «Всего задач» осталось прежним.
  const count = page.registry.get('#task-count');
  assert.equal(count.textContent, '3', 'количество задач прежнее');

  // Показ списка выполнился РОВНО ОДИН раз.
  assert.equal(renderCalls.length, 1, 'ровно один показ');

  // Сообщение об ошибке на принятом переходе НЕ появляется.
  assert.equal(page.errors.length, 0, 'на принятом переходе ошибок нет');

  // Оформление: тема переключается тем же приёмом, что и раньше.
  // Здесь проверяется лишь то, что переход НЕ трогает класс body.
  assert.equal(
    page.document.body.classList.contains('dark'),
    false,
    'переход не меняет оформление'
  );

  // Счётчик кликов — отдельная величина, не связанная с задачами.
  assert.equal(
    typeof api.transitionTask,
    'function',
    'функция перехода доступна и не затронута'
  );
});

test('P17b: оформление и счётчик покрываются постоянным набором Урока 11', () => {
  // ГРАНИЦА ПОКРЫТИЯ: этот набор НЕ моделирует тему и счётчик — это
  // делает tools/check-lesson-11.mjs (P19, P19b, P20). Урок 13 их НЕ
  // ломает: он меняет только задачи.
  assert.match(
    lesson13,
    /счётчик[^\n]*оформление/i,
    'урок требует проверить счётчик и оформление'
  );
});

// ---------------------------------------------------------------------------
// ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ
//
// Каждый контроль ИСПОЛНЯЕТ испорченную реализацию или испорченный путь
// показа и проверяет, что соответствующее требование действительно
// ломается. Текстовая проверка сама по себе НЕ является достаточным
// доказательством отрицательного контроля.
// ---------------------------------------------------------------------------

test('NC-1: реализация, разрешающая new + COMPLETE, ломает контракт таблицы переходов', () => {
  // Испорченная реализация: запрещённый переход разрешён.
  const broken = transitionTaskSource.replace(
    /if \(task\.status === 'new' && event === 'START'\) \{/,
    [
      "if (task.status === 'new' && event === 'COMPLETE') {",
      "  task.status = 'done';",
      '  return true;',
      '}',
      '',
      "if (task.status === 'new' && event === 'START') {"
    ].join('\n')
  );

  assert.notEqual(broken, transitionTaskSource, 'запрещённый переход действительно разрешён');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  const result = api.transitionTask(0, 'COMPLETE');
  const after = snapshot(tasks);

  // Постусловие таблицы ЛОМАЕТСЯ: событие принято, а по таблице — отказ.
  assert.equal(result, true, 'испорченная реализация приняла запрещённый переход');
  assert.notEqual(
    result,
    false,
    'контракт «new + COMPLETE отклонён» должен ломаться'
  );
  assert.equal(tasks[0].status, 'done', 'задача была изменена в обход таблицы');
  assert.notEqual(
    tasks[0].status,
    'new',
    'состояние изменилось там, где таблица требует «без изменений»'
  );
  assert.notDeepEqual(
    after.statuses,
    before.statuses,
    'коллекция изменилась, хотя таблица этого не разрешает'
  );

  // Контроль на ложное срабатывание: ЭТАЛОННАЯ реализация отклоняет
  // тот же переход и коллекцию НЕ меняет.
  const { api: goodApi, tasks: goodTasks } = buildApp();
  const goodBefore = snapshot(goodTasks);
  const goodResult = goodApi.transitionTask(0, 'COMPLETE');
  assert.equal(goodResult, false, 'эталонная реализация отклоняет new + COMPLETE');
  assert.deepEqual(
    snapshot(goodTasks),
    goodBefore,
    'эталонная реализация коллекцию не меняет'
  );
});

test('NC-2: реализация, пропускающая обновление при in_progress + COMPLETE, ломает постусловие', () => {
  // Испорченная реализация: событие принято, но состояние НЕ обновлено.
  const broken = transitionTaskSource.replace(
    /if \(task\.status === 'in_progress' && event === 'COMPLETE'\) \{\s*task\.status = 'done';/,
    "if (task.status === 'in_progress' && event === 'COMPLETE') {"
  );

  assert.notEqual(broken, transitionTaskSource, 'обновление действительно убрано');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const result = api.transitionTask(1, 'COMPLETE');

  assert.equal(result, true, 'функция отчиталась об успехе');
  assert.equal(tasks[1].status, 'in_progress', 'состояние НЕ обновилось');
  assert.notEqual(
    tasks[1].status,
    'done',
    'постусловие «in_progress + COMPLETE → done» должно ломаться'
  );
});

test('NC-3: реализация, отклоняющая done + COMPLETE, ломает контракт идемпотентного перехода', () => {
  // Испорченная реализация: разрешённый идемпотентный переход отклоняется.
  const broken = transitionTaskSource.replace(
    /if \(task\.status === 'done' && event === 'COMPLETE'\) \{\s*return true;\s*\}/,
    "if (task.status === 'done' && event === 'COMPLETE') {\n    return false;\n  }"
  );

  assert.notEqual(broken, transitionTaskSource, 'идемпотентный переход действительно отклонён');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  const result = api.transitionTask(2, 'COMPLETE');
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция отказала');
  assert.notEqual(
    result,
    true,
    'контракт «done + COMPLETE принят» должен ломаться'
  );
  // Состояние при этом осталось прежним — как и при настоящем отказе.
  assert.deepEqual(after, before, 'состояние не изменилось');
});

test('NC-4: реализация, меняющая ЧУЖУЮ задачу, ломает границу допустимых изменений', () => {
  // Испорченная реализация: кроме выбранной меняется ещё и другая задача.
  const broken = transitionTaskSource.replace(
    /if \(task\.status === 'in_progress' && event === 'COMPLETE'\) \{\s*task\.status = 'done';/,
    [
      "if (task.status === 'in_progress' && event === 'COMPLETE') {",
      "  task.status = 'done';",
      "  tasks[0].status = 'done';"
    ].join('\n')
  );

  assert.notEqual(broken, transitionTaskSource, 'лишнее изменение действительно добавлено');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  const result = api.transitionTask(1, 'COMPLETE');
  const after = snapshot(tasks);

  // Постусловие про выбранную задачу ПРОХОДИТ — это важно.
  assert.equal(result, true, 'функция отчиталась об успехе');
  assert.equal(tasks[1].status, 'done', 'выбранная задача завершена');

  // Граница допустимых изменений ЛОМАЕТСЯ.
  assert.equal(tasks[0].status, 'done', 'чужая задача тоже изменилась');
  assert.notEqual(
    after.statuses[0],
    before.statuses[0],
    'граница «остальные задачи не изменились» должна ломаться'
  );

  // Инвариант при этом ЦЕЛ — это и есть различие двух требований.
  assert.equal(
    invariantHolds(tasks),
    true,
    'инвариант состояния остаётся в силе даже при лишнем изменении'
  );
});

test('NC-5: реализация, мутирующая состояние при ОТКАЗЕ, ломает контракт отказа', () => {
  // Испорченная реализация: отклонённый переход всё равно меняет данные.
  // Мутация вставляется в ПОСЛЕДНИЙ `return false;` функции — это отказ
  // для непредусмотренной пары «состояние + событие».
  const broken = transitionTaskSource.replace(
    /\n  return false;\n\}/,
    "\n  tasks[0].status = 'done';\n  return false;\n}"
  );

  assert.notEqual(broken, transitionTaskSource, 'мутация при отказе действительно добавлена');
  assert.match(broken, /tasks\[0\]\.status = 'done';/, 'мутация присутствует в коде');

  const { api, tasks } = buildApp({ transitionSource: broken });

  const before = snapshot(tasks);
  const result = api.transitionTask(0, 'COMPLETE');
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция отказала');
  assert.notEqual(
    after.statuses[0],
    before.statuses[0],
    'контракт «отказ ничего не меняет» должен ломаться'
  );
  assert.notDeepEqual(
    after.statuses,
    before.statuses,
    'коллекция изменилась, хотя отказ не имеет права ничего менять'
  );

  // Контроль на ложное срабатывание: ЭТАЛОННАЯ реализация при отказе
  // коллекцию НЕ меняет.
  const { api: goodApi, tasks: goodTasks } = buildApp();
  const goodBefore = snapshot(goodTasks);
  const goodResult = goodApi.transitionTask(0, 'COMPLETE');
  assert.equal(goodResult, false, 'эталонная реализация отказала');
  assert.deepEqual(
    snapshot(goodTasks),
    goodBefore,
    'эталонная реализация коллекцию не меняет'
  );
});

test('NC-6: реализация, молча принимающая НЕИЗВЕСТНОЕ состояние, ломает инвариант', () => {
  // Испорченная реализация: неизвестное состояние считается «новым»
  // и молча принимается.
  const broken = transitionTaskSource.replace(
    /if \(task\.status === 'new' && event === 'START'\) \{/,
    "if (task.status === 'mystery' && event === 'START') {\n    task.status = 'in_progress';\n    return true;\n  }\n\n  if (task.status === 'new' && event === 'START') {"
  );

  assert.notEqual(broken, transitionTaskSource, 'неизвестное состояние действительно принято');

  const { api, tasks } = buildApp({
    transitionSource: broken,
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', status: 'mystery' }, " +
      "{ title: 'Сделать упражнение', status: 'in_progress' }, " +
      "{ title: 'Проверить результат', status: 'done' }];"
  });

  const before = snapshot(tasks);
  const result = api.transitionTask(0, 'START');
  const after = snapshot(tasks);

  assert.equal(result, true, 'испорченная реализация молча приняла событие');
  assert.notEqual(
    result,
    false,
    'контракт «неизвестное состояние отклоняется» должен ломаться'
  );
  assert.equal(tasks[0].status, 'in_progress', 'состояние изменено в обход правил');
  assert.notDeepEqual(
    after.statuses,
    before.statuses,
    'коллекция изменилась, хотя неизвестное состояние — это отказ'
  );

  // Контроль на ложное срабатывание: ЭТАЛОННАЯ реализация неизвестное
  // состояние отклоняет и коллекцию НЕ меняет.
  const { api: goodApi, tasks: goodTasks } = buildApp({
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', status: 'mystery' }, " +
      "{ title: 'Сделать упражнение', status: 'in_progress' }, " +
      "{ title: 'Проверить результат', status: 'done' }];"
  });
  const goodBefore = snapshot(goodTasks);
  const goodResult = goodApi.transitionTask(0, 'START');
  assert.equal(goodResult, false, 'эталонная реализация отклонила неизвестное состояние');
  assert.deepEqual(
    snapshot(goodTasks),
    goodBefore,
    'эталонная реализация коллекцию не меняет'
  );
});

test('NC-7: показ, читающий устаревшее поле `done`, ломает контракт показа', () => {
  // Испорченный путь показа: ВСЕ чтения `task.status` заменены на
  // `task.done` — то есть показ работает по устаревшему полю, которого
  // у мигрированных задач больше нет.
  //
  // У задач поля `done` НЕТ, поэтому `task.done` — `undefined`:
  //   - задача в состоянии `in_progress` показывается как «Новая»
  //     (проверка `task.done === 'in_progress'` ложна);
  //   - задача в состоянии `done` НЕ показывается как «Выполнена»
  //     (проверка `task.done === 'done'` ложна).
  // Итог: подписи состояний не соответствуют данным.
  const brokenRender = renderTaskListSource.replace(
    /task\.status/g,
    'task.done'
  );

  assert.notEqual(brokenRender, renderTaskListSource, 'показ действительно читает task.done');
  assert.match(brokenRender, /task\.done/, 'в испорченном показе есть чтение task.done');
  assert.doesNotMatch(brokenRender, /task\.status/, 'в испорченном показе нет чтения task.status');

  const { api, page } = buildApp({ renderSource: brokenRender });

  api.renderTaskList();

  const list = page.registry.get('#task-list');
  const shown = list.children.map((item) => item.textContent);

  // Вторая задача — `in_progress`, но испорченный показ не знает
  // про такое состояние и показывает «Новая».
  assert.equal(shown[1], 'Сделать упражнение — Новая', 'испорченный показ подменяет состояние');
  assert.notEqual(
    shown[1],
    'Сделать упражнение — В работе',
    'контракт подписи «В работе» должен ломаться'
  );

  // Третья задача — `done`, но испорченный показ её не узнаёт.
  assert.notEqual(
    shown[2],
    'Проверить результат — Выполнена',
    'контракт подписи «Выполнена» должен ломаться'
  );

  // Подписи не соответствуют данным.
  assert.notDeepEqual(
    shown,
    ['Прочитать главу — Новая', 'Сделать упражнение — В работе', 'Проверить результат — Выполнена'],
    'подписи испорченного показа не соответствуют состояниям'
  );

  // Контроль на ложное срабатывание: с эталонным показом подписи верны.
  const { api: goodApi, page: goodPage } = buildApp();
  goodApi.renderTaskList();
  const goodShown = goodPage.registry
    .get('#task-list')
    .children.map((item) => item.textContent);
  assert.deepEqual(
    goodShown,
    ['Прочитать главу — Новая', 'Сделать упражнение — В работе', 'Проверить результат — Выполнена'],
    'эталонный показ корректен'
  );
});
