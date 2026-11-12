#!/usr/bin/env node
/**
 * Инструкторский smoke-тест для Урока 12.
 *
 * ЗАПУСК (из корня репозитория, стандартный Node.js, без установки пакетов):
 *
 *     node --test tools/check-lesson-12.mjs
 *
 * Тест НЕ является частью ученического пути: ученику его запускать не нужно.
 * Он проверяет центральные контракты Урока 12:
 *   - markTaskDone() завершает ИМЕННО выбранную задачу и возвращает true;
 *   - повторный вызов идемпотентен;
 *   - остальные задачи, их названия и количество задач НЕ меняются;
 *   - недопустимый индекс (-1, выход за границы, дробный, NaN, строка)
 *     отклоняется: возвращает false и НЕ меняет ни одной задачи;
 *   - completeSelectedTask() вызывает markTaskDone() и показывает список
 *     ровно один раз при успехе и ни разу при отказе;
 *   - разметка и селекторы прежние: #task-choice и #complete-selected-task;
 *   - новый обработчик не дублируется.
 *
 * Канонические фрагменты кода ИЗВЛЕКАЮТСЯ из LESSON-12.md по НЕОДНОЗНАЧНОМУ
 * СТРУКТУРНОМУ МАРКЕРУ. Если фрагмент не найден или найден неоднозначно —
 * тест ПАДАЕТ с понятным сообщением, а не выбирает произвольный блок.
 *
 * ГРАНИЦЫ ДОКАЗАТЕЛЬСТВ:
 *   - JS-семантика (контракт данных) исполняется в реальном Node.js.
 *   - DOM проверяется ЧЕРЕЗ МИНИМАЛЬНУЮ ИМИТАЦИЮ: маленький document/
 *     querySelector-заглушку и счётчик вызовов показа. Это НЕ браузер,
 *     НЕ нативное выполнение и НЕ визуальная проверка.
 *   - Остальные UI-контракты (выпадающий список, выбор по умолчанию,
 *     переключение темы) покрываются постоянным набором Урока 11.
 *
 * ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ (NC-1..NC-6) исполняют ИСПОРЧЕННЫЕ реализации и
 * проверяют, что соответствующая проверка действительно ломается.
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

const lesson12 = readFileSync(join(ROOT, 'LESSON-12.md'), 'utf8');

/**
 * Возвращает fenced-блоки кода (javascript / html) вместе с заголовком
 * раздела, в котором они находятся.
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

const jsBlocks = fencedBlocks(lesson12, 'javascript');

/**
 * Находит ЕДИНСТВЕННЫЙ блок кода по предикату. Ноль или больше одного —
 * понятная ошибка (тест падает, а не выбирает произвольный блок).
 */
function uniqueBlock(blocks, predicate, description) {
  const found = blocks.filter(predicate);
  if (found.length === 0) {
    throw new Error(
      'В LESSON-12.md не найден блок: ' + description +
      ' (найдено 0 подходящих блоков)'
    );
  }
  if (found.length > 1) {
    throw new Error(
      'В LESSON-12.md блок неоднозначен: ' + description +
      ' (найдено ' + found.length + ' подходящих блоков: ' +
      found.map((b) => b.context).join(' | ') + ')'
    );
  }
  return found[0].code;
}

/**
 * СТРУКТУРНЫЙ МАРКЕР: единственный javascript-блок, в котором объявлена
 * функция `markTaskDone(`. Экспериментальные «испорченные» варианты в
 * шаге Modify показывают отдельные СТРОКИ, а не отдельное объявление
 * функции целиком, — поэтому подходит ровно один блок.
 */
const markTaskDoneSource = uniqueBlock(
  jsBlocks,
  (block) => /^function markTaskDone\(index\)\s*\{/m.test(block.code),
  'каноническая функция markTaskDone(index) — операция данных'
);

const completeSelectedTaskSource = uniqueBlock(
  jsBlocks,
  (block) => /^function completeSelectedTask\(\)\s*\{/m.test(block.code),
  'каноническая функция completeSelectedTask()'
);

// ---------------------------------------------------------------------------
// Сборка исполняемого приложения
// ---------------------------------------------------------------------------

const DEFAULT_TASKS =
  "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }];";

/**
 * Минимальная имитация document: нужен только querySelector по id.
 * Никакого layout, никакого CSS, никакого настоящего рендеринга.
 */
function makeFakeDocument() {
  const registry = new Map();
  const errors = [];

  function makeElement(id) {
    return {
      id: String(id).replace('#', ''),
      textContent: '',
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
 * Собирает приложение из канонических фрагментов LESSON-12.md.
 *
 * Любой фрагмент можно подменить, чтобы получить испорченную реализацию
 * для отрицательного контроля.
 *
 * `renderCalls` — счётчик вызовов показа списка: именно он наблюдает
 * постусловие «после успешного завершения список показан заново».
 */
function buildApp(options = {}) {
  const {
    tasksLiteral = DEFAULT_TASKS,
    markSource = markTaskDoneSource,
    completeSource = completeSelectedTaskSource,
    extraSource = ''
  } = options;

  const page = makeFakeDocument();
  const renderCalls = [];

  const source = `
${tasksLiteral}

${markSource}

${completeSource}

${extraSource}
`;

/**
 * Показ списка: считаем вызовы и обновляем счётчик на странице.
 * Объявлен ВНУТРИ исполняемого кода, чтобы `renderTaskList()` была
 * обычной функцией, которую вызывает `completeSelectedTask()`.
 */
  const RENDER_SOURCE = `
function renderTaskList() {
  renderCalls.push('renderTaskList');
  const count = document.querySelector('#task-count');
  if (count) {
    count.textContent = String(tasks.length);
  }
}
`;

  const factory = new Function(
    'document',
    'console',
    'renderCalls',
    `${source}
${RENDER_SOURCE}
return {
  tasks,
  markTaskDone,
  completeSelectedTask,
  renderTaskList,
  get renderCalls() { return renderCalls; }
};`
  );

  const api = factory(page.document, page.consoleStub, renderCalls);

  return { page, api, tasks: api.tasks, renderCalls };
}

/**
 * НЕЗАВИСИМЫЙ снимок состояния задач.
 * Ожидаемые значения не выводятся из проверяемой реализации: снимок
 * строится из ЗНАЧЕНИЙ, а сравнение идёт с независимо заданными ожиданиями.
 */
function snapshot(tasks) {
  return {
    count: tasks.length,
    titles: tasks.map((t) => t.title),
    done: tasks.map((t) => t.done === true)
  };
}

/** Три задачи в начальном состоянии — ожидания заданы НЕЗАВИСИМО. */
const EXPECTED_INITIAL = {
  count: 3,
  titles: ['Прочитать главу', 'Сделать упражнение', 'Проверить результат'],
  done: [false, false, false]
};

// ---------------------------------------------------------------------------
// Статические проверки текста урока
// ---------------------------------------------------------------------------

test('урок содержит канонические фрагменты', () => {
  // markTaskDone(): операция данных, без обращения к странице.
  assert.match(markTaskDoneSource, /function markTaskDone\(index\)/);
  assert.match(markTaskDoneSource, /Number\.isInteger\(index\)/);
  assert.match(markTaskDoneSource, /index < 0 \|\| index >= tasks\.length/);
  assert.match(markTaskDoneSource, /tasks\[index\]\.done = true;/);
  assert.match(markTaskDoneSource, /return true;/);
  assert.match(markTaskDoneSource, /return false;/);
  assert.doesNotMatch(markTaskDoneSource, /document\./, 'операция данных не обращается к странице');
  assert.doesNotMatch(markTaskDoneSource, /renderTaskList/, 'операция данных не показывает список');

  // completeSelectedTask(): связь с интерфейсом, вызывает markTaskDone().
  assert.match(completeSelectedTaskSource, /function completeSelectedTask\(\)/);
  assert.match(completeSelectedTaskSource, /#task-choice/);
  assert.match(completeSelectedTaskSource, /markTaskDone\(select\.selectedIndex\)/);
  assert.match(completeSelectedTaskSource, /renderTaskList\(\);/);
  assert.doesNotMatch(
    completeSelectedTaskSource,
    /tasks\[index\]\.done = true;/,
    'изменение данных переехало в markTaskDone()'
  );
});

test('урок различает предусловие, постусловие и инвариант', () => {
  assert.match(lesson12, /\*\*Предусловие\*\*/, 'термин «предусловие» есть');
  assert.match(lesson12, /\*\*Постусловие\*\*/, 'термин «постусловие» есть');
  assert.match(lesson12, /\*\*Инвариант\*\*/, 'термин «инвариант» есть');

  // Это три стороны ОДНОГО контракта, а не три отдельные темы.
  assert.match(
    lesson12,
    /Три стороны одного контракта/,
    'термины поданы как аспекты одного контракта'
  );
  assert.match(
    lesson12,
    /Не всякая защита — это предусловие/,
    'различие защиты и предусловия проговорено'
  );
  assert.match(
    lesson12,
    /отказ — не поломка/i,
    'отказ определён как допустимое поведение'
  );
});

test('урок требует контракт ДО исполнения кода', () => {
  const predictStart = lesson12.indexOf('## Шаг 1. Predict');
  const runStart = lesson12.indexOf('## Шаг 2. Run');
  assert.ok(predictStart >= 0, 'в LESSON-12.md есть раздел «Шаг 1. Predict»');
  assert.ok(runStart >= 0, 'в LESSON-12.md есть раздел «Шаг 2. Run»');

  const predictSection = lesson12.slice(predictStart, runStart);

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
    /Контракт операции/i,
    'контракт записан в шаге Predict, до реализации'
  );
});

test('в уроке порядок PRIMM: Predict → Run → Investigate → Modify → Make', () => {
  const predict = lesson12.indexOf('## Шаг 1. Predict');
  const run = lesson12.indexOf('## Шаг 2. Run');
  const investigate = lesson12.indexOf('## Шаг 3. Investigate');
  const modify = lesson12.indexOf('## Шаг 4. Modify');
  const make = lesson12.indexOf('## Шаг 5. Make');

  for (const [name, pos] of [
    ['Predict', predict],
    ['Run', run],
    ['Investigate', investigate],
    ['Modify', modify],
    ['Make', make]
  ]) {
    assert.ok(pos >= 0, 'в LESSON-12.md есть раздел «' + name + '»');
  }

  assert.ok(predict < run, 'Predict идёт перед Run');
  assert.ok(run < investigate, 'Run идёт перед Investigate');
  assert.ok(investigate < modify, 'Investigate идёт перед Modify');
  assert.ok(modify < make, 'Modify идёт перед Make');
});

test('Make остаётся необязательным', () => {
  assert.match(lesson12, /Шаг 5\. Make[\s\S]*?необязательн/i, 'шаг Make помечен необязательным');
});

test('урок не вводит запрещённые понятия', () => {
  const forbidden = [
    'Hoare',
    'Hoare logic',
    'Z3',
    'Dafny',
    'SMT',
    'theorem prover',
    'property-based',
    'fast-check',
    'TypeScript',
    'interface ',
    'extends ',
    'class ',
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
      'в каноническом коде Урока 12 не должно быть: ' + token
    );
  }
});

test('урок не требует от ученика Node.js и тестовых библиотек', () => {
  // Node.js упоминается только как «не нужен ученику».
  const nodeMentions = lesson12
    .split('\n')
    .filter((line) => /Node\.js|node:test|node:assert/.test(line));
  for (const line of nodeMentions) {
    assert.ok(
      /не нужен|не понадобится|не требуется|не входит|отдельная вещь|ни Node\.js/i.test(line),
      'Node.js упоминается только как необязательный: ' + line
    );
  }

  // Ученику не предлагается ставить пакеты.
  assert.doesNotMatch(
    lesson12,
    /npm install|npm i |установите пакет/i,
    'урок не предлагает установку пакетов'
  );
});

test('урок не заявляет, что контракт и проверки — это доказательство', () => {
  assert.match(
    lesson12,
    /Контракт \+ проверки — это не доказательство/i,
    'явно сказано, что это не доказательство'
  );
  assert.match(
    lesson12,
    /console\.assert\(\)/,
    'разобрано, что именно делает console.assert()'
  );
  assert.match(
    lesson12,
    /не останавливает/i,
    'сказано, что console.assert() не останавливает программу'
  );
});

// ---------------------------------------------------------------------------
// ПОЗИТИВНЫЕ ПРОВЕРКИ КОНТРАКТА ДАННЫХ
// ---------------------------------------------------------------------------

test('P1: допустимый индекс завершает ИМЕННО выбранную задачу', () => {
  const { api, tasks } = buildApp();

  const result = api.markTaskDone(1);

  assert.equal(result, true, 'функция вернула true');
  assert.equal(tasks[1].done, true, 'вторая задача завершена');
  assert.equal(tasks[0].done, false, 'первая не тронута');
  assert.equal(tasks[2].done, false, 'третья не тронута');
});

test('P2: успешный вызов возвращает true', () => {
  const { api } = buildApp();

  assert.equal(api.markTaskDone(0), true, 'индекс 0 принят');
  assert.equal(api.markTaskDone(2), true, 'индекс 2 принят');
  assert.equal(api.markTaskDone(0), true, 'повторный вызов тоже принят');
});

test('P3: повторный вызов возвращает true и ничего не портит', () => {
  const { api, tasks } = buildApp();

  api.markTaskDone(1);
  const second = api.markTaskDone(1);
  const third = api.markTaskDone(1);

  assert.equal(second, true, 'второй вызов вернул true');
  assert.equal(third, true, 'третий вызов вернул true');
  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, true, false],
    'состояния прежние: завершена только вторая, ровно один раз'
  );
});

test('P4: состояния ОСТАЛЬНЫХ задач не изменились', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  api.markTaskDone(1);
  const after = snapshot(tasks);

  // Остальные задачи: индексы 0 и 2 — прежние.
  assert.equal(after.done[0], before.done[0], 'состояние первой прежнее');
  assert.equal(after.done[2], before.done[2], 'состояние третьей прежнее');
  assert.equal(after.done[1], true, 'изменилась только выбранная');
});

test('P5: названия задач не изменились', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  api.markTaskDone(2);
  const after = snapshot(tasks);

  assert.deepEqual(
    after.titles,
    before.titles,
    'названия задач прежние'
  );
  assert.deepEqual(
    after.titles,
    EXPECTED_INITIAL.titles,
    'названия совпадают с независимо заданными ожиданиями'
  );
});

test('P6: количество задач не изменилось', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  api.markTaskDone(1);
  const after = snapshot(tasks);

  assert.equal(after.count, before.count, 'количество прежнее');
  assert.equal(after.count, EXPECTED_INITIAL.count, 'количество равно 3');
  assert.equal(tasks.length, 3, 'в массиве по-прежнему три задачи');
});

test('P7: недопустимый индекс -1 отклоняется', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  const result = api.markTaskDone(-1);
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция вернула false');
  assert.deepEqual(after, before, 'ни одна задача не изменилась');
});

test('P8: индекс за границами массива отклоняется', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  const result = api.markTaskDone(99);
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция вернула false');
  assert.deepEqual(after, before, 'ни одна задача не изменилась');
});

test('P9: дробный индекс отклоняется', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  const result = api.markTaskDone(1.5);
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция вернула false');
  assert.deepEqual(after, before, 'ни одна задача не изменилась');
});

test('P10: NaN отклоняется', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  const result = api.markTaskDone(NaN);
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция вернула false');
  assert.deepEqual(after, before, 'ни одна задача не изменилась');
});

test('P11: строковый индекс отклоняется', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);
  const result = api.markTaskDone('1');
  const after = snapshot(tasks);

  assert.equal(result, false, 'функция вернула false');
  assert.deepEqual(after, before, 'ни одна задача не изменилась');
});

test('P12: недопустимый вход не меняет НИ ОДНОЙ задачи', () => {
  const { api, tasks } = buildApp();

  const before = snapshot(tasks);

  for (const bad of [-1, -5, 3, 99, 1.5, NaN, '1', '', null, undefined, true]) {
    const result = api.markTaskDone(bad);
    assert.equal(result, false, 'вход ' + String(bad) + ' отклонён');
  }

  const after = snapshot(tasks);

  assert.equal(after.count, before.count, 'количество прежнее');
  assert.deepEqual(after.titles, before.titles, 'названия прежние');
  assert.deepEqual(after.done, before.done, 'состояния прежние');
});

test('P13: пустой массив задач обрабатывается безопасно', () => {
  const { api, tasks } = buildApp({ tasksLiteral: 'const tasks = [];' });

  assert.equal(tasks.length, 0, 'задач нет');

  const result = api.markTaskDone(0);

  assert.equal(result, false, 'функция вернула false, а не упала');
  assert.equal(tasks.length, 0, 'массив остался пустым');
});

// ---------------------------------------------------------------------------
// ПОЗИТИВНЫЕ ПРОВЕРКИ СВЯЗИ С ИНТЕРФЕЙСОМ
// ---------------------------------------------------------------------------

test('P14: успешное завершение через интерфейс показывает список РОВНО ОДИН раз', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  api.completeSelectedTask();

  assert.equal(tasks[1].done, true, 'выбранная задача завершена');
  assert.equal(renderCalls.length, 1, 'показ списка вызван ровно один раз');
  assert.deepEqual(renderCalls, ['renderTaskList'], 'вызвана именно функция показа списка');
  assert.equal(
    page.registry.get('#task-count').textContent,
    '3',
    'счётчик на странице прежний'
  );
});

test('P15: отклонённое завершение не меняет состояние и НЕ показывает список', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const before = snapshot(tasks);

  const select = page.registry.get('#task-choice');
  select.selectedIndex = -1;

  api.completeSelectedTask();

  const after = snapshot(tasks);

  assert.deepEqual(after, before, 'ни одна задача не изменилась');
  assert.equal(renderCalls.length, 0, 'показ списка не вызывался');
  assert.deepEqual(page.errors, ['Задача не выбрана'], 'в консоли понятное сообщение');
});

test('P16: селектор и кнопка завершения остались прежними', () => {
  const { page } = buildApp();

  // Те же идентификаторы, что и в Уроке 11.
  assert.ok(page.registry.get('#task-choice'), 'выпадающий список на месте');
  assert.ok(page.registry.get('#complete-selected-task'), 'кнопка завершения на месте');

  assert.match(
    completeSelectedTaskSource,
    /document\.querySelector\('#task-choice'\)/,
    'функция читает тот же список выбора'
  );

  // Новая кнопка и новый селектор НЕ введены.
  const codeOnly = jsBlocks.map((b) => b.code).join('\n');
  assert.doesNotMatch(codeOnly, /#uncomplete/, 'новой кнопки нет');
  assert.doesNotMatch(codeOnly, /#complete-first-task/, 'старая кнопка первой задачи не вернулась');
  assert.doesNotMatch(
    completeSelectedTaskSource,
    /addEventListener/,
    'функция не регистрирует собственных обработчиков'
  );
});

test('P17: дублирующий обработчик не заводится', () => {
  const { api, tasks, renderCalls, page } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  // Подписка выполняется ОДИН раз: completeSelectedTask() — обработчик,
  // а не место, где регистрируются обработчики.
  api.completeSelectedTask();

  assert.equal(renderCalls.length, 1, 'одно нажатие — один показ');
  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, true, false],
    'завершена только выбранная задача, ровно один раз'
  );

  // Повторный вызов той же функции — та же операция, а не вторая подписка.
  api.completeSelectedTask();
  assert.equal(renderCalls.length, 2, 'два вызова — два показа, а не четыре');
  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, true, false],
    'состояния прежние: повтор не создал второго изменения'
  );
});

// ---------------------------------------------------------------------------
// ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ
//
// Каждый контроль ИСПОЛНЯЕТ испорченную реализацию и проверяет, что
// соответствующая проверка действительно ломается. Контроль считается
// действенным только тогда, когда он исполняет испорченный код и
// наблюдает КОНКРЕТНОЕ нарушение своего контракта.
// ---------------------------------------------------------------------------

test('NC-1: реализация, всегда завершающая tasks[0], ломает постусловие о выбранной задаче', () => {
  // Испорченная реализация: индекс выбранной задачи игнорируется.
  const broken = markTaskDoneSource.replace(
    /tasks\[index\]\.done = true;/,
    'tasks[0].done = true;'
  );

  assert.notEqual(broken, markTaskDoneSource, 'индекс действительно подменён на 0');

  const { api, tasks } = buildApp({ markSource: broken });

  const result = api.markTaskDone(1);

  // Постусловие «у выбранной задачи done === true» обязано сломаться.
  assert.equal(result, true, 'функция отчиталась об успехе');
  assert.equal(tasks[1].done, false, 'вторая (выбранная) задача НЕ завершена');
  assert.notEqual(
    tasks[1].done,
    true,
    'постусловие о выбранной задаче должно сломаться'
  );
  assert.equal(tasks[0].done, true, 'завершена не та задача — первая');
});

test('NC-2: реализация, меняющая ЧУЖУЮ задачу, ломает инвариант о остальных задачах', () => {
  // Испорченная реализация: кроме выбранной меняется ещё и первая задача.
  const broken = markTaskDoneSource.replace(
    /tasks\[index\]\.done = true;/,
    'tasks[index].done = true;\n  tasks[0].done = true;'
  );

  assert.notEqual(broken, markTaskDoneSource, 'добавлено лишнее изменение');

  const { api, tasks } = buildApp({ markSource: broken });

  const result = api.markTaskDone(1);

  // Постусловие про выбранную задачу ПРОХОДИТ — это важно:
  assert.equal(result, true, 'функция отчиталась об успехе');
  assert.equal(tasks[1].done, true, 'выбранная задача завершена');

  // А инвариант про остальные задачи ЛОМАЕТСЯ.
  assert.equal(tasks[0].done, true, 'первая задача тоже изменилась');
  assert.notEqual(
    tasks[0].done,
    false,
    'инвариант «остальные задачи не изменились» должен сломаться'
  );
});

test('NC-3: реализация, меняющая длину массива, ломает инвариант о количестве задач', () => {
  // Испорченная реализация: при завершении задачи в массив добавляется
  // лишний элемент.
  const broken = markTaskDoneSource.replace(
    /tasks\[index\]\.done = true;/,
    "tasks[index].done = true;\n  tasks.push({ title: 'Лишняя', done: false });"
  );

  assert.notEqual(broken, markTaskDoneSource, 'длина массива действительно меняется');

  const { api, tasks } = buildApp({ markSource: broken });

  const before = snapshot(tasks);
  api.markTaskDone(1);
  const after = snapshot(tasks);

  // Постусловие про выбранную задачу ПРОХОДИТ:
  assert.equal(after.done[1], true, 'выбранная задача завершена');

  // А инвариант про количество задач ЛОМАЕТСЯ.
  assert.equal(after.count, before.count + 1, 'задача добавилась');
  assert.notEqual(
    after.count,
    before.count,
    'инвариант «количество задач не изменилось» должен сломаться'
  );
  assert.equal(after.count, EXPECTED_INITIAL.count + 1, 'стало четыре задачи вместо трёх');
});

test('NC-4: реализация, меняющая задачу при недопустимом индексе, ломает контракт отказа', () => {
  // Испорченная реализация: защита ослаблена — недопустимый индекс
  // приводит к изменению данных вместо отказа. Индекс приводится к
  // целому и зажимается в диапазон, чтобы дефект был ИЗМЕНЕНИЕМ
  // СОСТОЯНИЯ, а не падением (падание — другой дефект).
  const broken = markTaskDoneSource
    .replace(
      /if \(!Number\.isInteger\(index\) \|\| index < 0 \|\| index >= tasks\.length\) \{\s*return false;\s*\}/,
      ''
    )
    .replace(
      /tasks\[index\]\.done = true;/,
      'tasks[Math.max(0, Math.min(tasks.length - 1, Math.trunc(index)))].done = true;'
    );

  assert.notEqual(broken, markTaskDoneSource, 'защита действительно ослаблена');

  const { api, tasks } = buildApp({ markSource: broken });

  const before = snapshot(tasks);
  const result = api.markTaskDone(-1);
  const after = snapshot(tasks);

  // Контракт отказа ЛОМАЕТСЯ: вместо `false` — другой результат…
  assert.notEqual(result, false, 'функция не отказала, а вернула другой результат');
  // …и данные изменились, хотя этого быть не должно.
  assert.notEqual(
    after.done,
    before.done,
    'контракт «недопустимый вход отклонён и ничего не изменил» должен сломаться'
  );
  assert.notDeepEqual(after.done, before.done, 'состояние задач действительно изменилось');
});

test('NC-5: связь с интерфейсом, не вызывающая показ, ломает постусловие о показе', () => {
  // Испорченная реализация: данные меняются, но список не перерисовывается.
  const broken = completeSelectedTaskSource.replace(/\n\s*renderTaskList\(\);/, '');

  assert.notEqual(broken, completeSelectedTaskSource, 'вызов renderTaskList() действительно удалён');

  const { api, tasks, renderCalls, page } = buildApp({ completeSource: broken });

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 1;

  api.completeSelectedTask();

  // Данные изменились…
  assert.equal(tasks[1].done, true, 'данные изменились');

  // …а показ не произошёл: постусловие «список показан заново» ЛОМАЕТСЯ.
  assert.equal(renderCalls.length, 0, 'показ списка не вызван');
  assert.notEqual(
    renderCalls.length,
    1,
    'постусловие «после успешного завершения список показан» должно сломаться'
  );
});

test('NC-6: реализация, возвращающая true без завершения задачи, ломает постусловие', () => {
  // Испорченная реализация: функция отчитывается об успехе, но задачу
  // не завершает.
  const broken = markTaskDoneSource.replace(
    /tasks\[index\]\.done = true;/,
    '// задача не завершается'
  );

  assert.notEqual(broken, markTaskDoneSource, 'завершение задачи действительно убрано');

  const { api, tasks } = buildApp({ markSource: broken });

  const result = api.markTaskDone(1);

  // Функция говорит «успех»…
  assert.equal(result, true, 'функция вернула true');

  // …а постусловие «у выбранной задачи done === true» ЛОМАЕТСЯ.
  assert.equal(tasks[1].done, false, 'выбранная задача НЕ завершена');
  assert.notEqual(
    tasks[1].done,
    true,
    'постусловие о выбранной задаче должно сломаться'
  );
});
