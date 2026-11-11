#!/usr/bin/env node
/**
 * Инструкторский smoke-тест для Уроков 08 и 09.
 *
 * ЗАПУСК (из корня репозитория, стандартный Node.js, без установки пакетов):
 *
 *     node tools/check-lessons-08-09.mjs
 *
 * Тест НЕ является частью ученического пути: ученику его запускать не нужно.
 * Он проверяет центральные контракты Уроков 08 и 09:
 *   - форма данных (массив объектов-задач с полями title и done);
 *   - семантика цикла for...of (число и порядок итераций, пустой массив);
 *   - построение списка задач ИЗ ДАННЫХ, а не из вручную записанных позиций;
 *   - отсутствие дублей при повторном вызове функции показа;
 *   - отказ смешанных данных и дублирующей миграции.
 *
 * Канонические фрагменты кода ИЗВЛЕКАЮТСЯ из LESSON-08.md и LESSON-09.md.
 * Если фрагмент не найден или найден неоднозначно — тест ПАДАЕТ с понятным
 * сообщением, а не выбирает произвольный блок.
 *
 * ГРАНИЦЫ ДОКАЗАТЕЛЬСТВ:
 *   - JS-семантика (`for...of`, миграция данных) исполняется в реальном Node.js.
 *   - DOM проверяется ЧЕРЕЗ ИМИТАЦИЮ минимального DOM (см. FakeDom ниже), а не в
 *     настоящем браузере. Это НЕ нативное выполнение в браузере и НЕ визуальная
 *     проверка отображения.
 *   - Реальное поведение ученика в браузере НЕ измерялось.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Мини-фреймворк утверждений
// ---------------------------------------------------------------------------

let passed = 0;
const failures = [];
let currentGroup = '(общее)';

function group(name) {
  currentGroup = name;
}

function check(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`[${currentGroup}] ${message}`);
  }
}

function equal(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(ok, `${message} — ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`);
}

// ---------------------------------------------------------------------------
// Извлечение канонических фрагментов из уроков
// ---------------------------------------------------------------------------

/**
 * Возвращает fenced-блоки ```javascript / ```html вместе с заголовком раздела,
 * в котором они находятся. Идентификация — по СОДЕРЖАНИЮ (заголовок + код),
 * а не по номерам строк: структура урока может сдвинуться, и это не должно
 * ломать тест.
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
 * Находит ЕДИНСТВЕННЫЙ блок кода по заголовку раздела и содержимому.
 * Если блоков ноль или больше одного — бросает ошибку с понятным текстом:
 * тест обязан упасть явно, а не молча выбрать произвольный блок.
 */
function uniqueBlock(blocks, contextMatcher, contentMatcher, description) {
  const matched = blocks.filter(
    (block) => contextMatcher(block.context) && contentMatcher(block.code)
  );
  if (matched.length === 0) {
    throw new Error(
      'Не найден канонический фрагмент: ' + description +
      '. Проверьте LESSON-08.md / LESSON-09.md.'
    );
  }
  if (matched.length > 1) {
    throw new Error(
      'Фрагмент найден неоднозначно (' + matched.length + ' совпадений): ' + description +
      '. Проверьте LESSON-08.md / LESSON-09.md.'
    );
  }
  return matched[0].code;
}

const lesson08 = readFileSync(join(ROOT, 'LESSON-08.md'), 'utf8');
const lesson09 = readFileSync(join(ROOT, 'LESSON-09.md'), 'utf8');

const blocks08 = fencedBlocks(lesson08, 'javascript');
const blocks09 = fencedBlocks(lesson09, 'javascript');
const htmlBlocks09 = fencedBlocks(lesson09, 'html');

/** Канонический массив из трёх объектов-задач (Урок 08, шаг Run). */
const tasksLiteral = uniqueBlock(
  blocks08,
  (context) => context.startsWith('### 1. Замените объявление'),
  (code) =>
    /^const tasks = \[/.test(code) &&
    (code.match(/\{ title:/g) || []).length === 3 &&
    !code.includes('tasks.push'),
  'массив tasks из трёх объектов (LESSON-08.md, шаг Run)'
);

/** Каноническая форма «три объекта + объектный push()» (Урок 08, чек-лист миграции). */
const tasksLiteralPlusPush = uniqueBlock(
  blocks08,
  (context) => context.startsWith('##### Чек-лист миграции'),
  (code) =>
    /^const tasks = \[/.test(code) &&
    /tasks\.push\(\{/.test(code) &&
    code.includes('done: false'),
  'форма миграции «три объекта + push()» (LESSON-08.md, чек-лист миграции)'
);

/** Каноническая форма «четыре объекта в литерале» (Урок 08, чек-лист миграции). */
const tasksLiteralFour = uniqueBlock(
  blocks08,
  (context) => context.startsWith('##### Чек-лист миграции'),
  (code) =>
    /^const tasks = \[/.test(code) &&
    !code.includes('tasks.push') &&
    (code.match(/\{ title:/g) || []).length === 4,
  'форма миграции «четыре объекта в литерале» (LESSON-08.md, чек-лист миграции)'
);

/** Каноническое преобразование вызова push() (Урок 08, чек-лист миграции). */
const pushConversion = uniqueBlock(
  blocks08,
  (context) => context.startsWith('##### Чек-лист миграции'),
  (code) => code.includes('// Было') && code.includes('// Стало') && code.includes('tasks.push('),
  'каноническое преобразование push() «// Было / // Стало» (LESSON-08.md, чек-лист миграции)'
);

/** Канонический цикл for...of (Урок 09, шаг Predict — самый маленький цикл). */
const forOfExample = uniqueBlock(
  blocks09,
  (context) => context.startsWith('### Самый маленький цикл'),
  (code) => code.includes('for (const task of tasks)') && code.includes('console.log(task.title)'),
  'канонический цикл for...of (LESSON-09.md, шаг Predict)'
);

/** Каноническая функция показа списка (Урок 09, шаг Run). */
const renderTaskListSource = uniqueBlock(
  blocks09,
  (context) => context.startsWith('#### JavaScript — напишите функцию показа'),
  (code) => code.includes('function renderTaskList()') && code.includes("document.querySelector('#task-list')"),
  'функция renderTaskList() (LESSON-09.md, шаг Run)'
);

/** Канонический HTML-блок со списком задач (Урок 09, шаг Run). */
const tasksPreviewHtml = uniqueBlock(
  htmlBlocks09,
  (context) => context.startsWith('#### HTML — замените блок'),
  (code) => code.includes('id="task-list"'),
  'HTML-блок со списком задач (LESSON-09.md, шаг Run)'
);

// ---------------------------------------------------------------------------
// Минимальная имитация DOM
// ---------------------------------------------------------------------------

class FakeTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.text = String(text);
    this.children = [];
  }

  get textContent() {
    return this.text;
  }

  set textContent(value) {
    this.text = String(value);
    this.children = [];
  }
}

class FakeElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.attributes = {};
    this._text = '';
  }

  get textContent() {
    if (this.children.length === 0) {
      return this._text;
    }
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

/**
 * Создаёт объект `document` для функции renderTaskList().
 * Внутреннее представление — минимальное: этого достаточно, чтобы проверить
 * количество <li>, их текст и порядок. Это ИМИТАЦИЯ DOM, не браузер.
 */
function makeFakeDocument({ withTaskList = true } = {}) {
  const registry = new Map();
  if (withTaskList) {
    registry.set('#task-list', new FakeElement('ul'));
  }
  const created = [];

  return {
    registry,
    created,
    document: {
      querySelector(selector) {
        return registry.get(selector) ?? null;
      },
      createElement(tagName) {
        const element = new FakeElement(tagName);
        created.push(element);
        return element;
      }
    }
  };
}

/** Выполняет функцию renderTaskList() из урока в изолированном контексте. */
function runRender(source, tasks, { withTaskList = true } = {}) {
  const fake = makeFakeDocument({ withTaskList });
  const logs = [];
  const errors = [];
  const factory = new Function(
    'document',
    'console',
    'tasks',
    `${source}\nreturn renderTaskList;`
  );
  const render = factory(fake.document, { log: (...a) => logs.push(a), error: (...a) => errors.push(a) }, tasks);
  render();
  return { list: fake.registry.get('#task-list') ?? null, logs, errors, fake };
}

// ---------------------------------------------------------------------------
// Исполняемые контракты
// ---------------------------------------------------------------------------

/**
 * Выполняет фрагмент кода в свежем контексте и возвращает ИТОГОВЫЙ массив tasks.
 * Фрагмент сам объявляет `const tasks = [...]`, поэтому параметром он не
 * передаётся — контекст каждый раз новый, как при перезагрузке страницы.
 */
function evalWithTasks(code) {
  const factory = new Function(`${code}\nreturn tasks;`);
  return factory();
}

/** Безопасное чтение текста пункта списка по индексу. */
function itemText(list, index) {
  const items = listItems(list);
  const item = items[index];
  return item ? item.textContent : null;
}

/**
 * Прогоняет цикл for...of и возвращает порядок напечатанных значений.
 * Массив передаётся параметром: цикл его не объявляет.
 */
function runForOf(code, tasks) {
  const logged = [];
  const factory = new Function('tasks', 'console', code);
  factory(tasks, { log: (value) => logged.push(value) });
  return logged;
}

// --- V3: семантика цикла for...of -----------------------------------------

group('V3 for...of');

{
  const tasks = evalWithTasks(tasksLiteral);

  const logged = runForOf(forOfExample, tasks);
  equal(logged.length, 3, 'три задачи → три сообщения');
  equal(logged, ['Прочитать главу', 'Сделать упражнение', 'Проверить результат'], 'порядок для трёх задач');

  const four = evalWithTasks(tasksLiteralFour);
  const loggedFour = runForOf(forOfExample, four);
  equal(loggedFour.length, 4, 'четыре задачи → четыре сообщения');
  equal(
    loggedFour,
    ['Прочитать главу', 'Сделать упражнение', 'Проверить результат', 'Написать отчёт'],
    'порядок для четырёх задач'
  );

  const one = evalWithTasks('const tasks = [{ title: \'Одна задача\', done: false }];');
  equal(runForOf(forOfExample, one).length, 1, 'одна задача → одно сообщение');

  const empty = evalWithTasks('const tasks = [];');
  equal(runForOf(forOfExample, empty).length, 0, 'пустой массив → ни одного сообщения');

  const reordered = evalWithTasks(
    "const tasks = [{ title: 'Третья', done: false }, { title: 'Первая', done: false }, { title: 'Вторая', done: false }];"
  );
  equal(
    runForOf(forOfExample, reordered),
    ['Третья', 'Первая', 'Вторая'],
    'порядок итераций следует порядку массива'
  );

  const done = evalWithTasks(
    "const tasks = [{ title: 'Готово', done: true }, { title: 'Не готово', done: false }];"
  );
  equal(
    runForOf(forOfExample, done),
    ['Готово', 'Не готово'],
    'for...of выдаёт значения, а не индексы; done не влияет на вывод title'
  );
}

// --- V2: миграция четвёртой задачи ----------------------------------------

group('V2 миграция задач');

/** Проверка формы данных: каждый элемент — объект с title и done. */
function dataShapeOk(tasks) {
  return (
    Array.isArray(tasks) &&
    tasks.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof item.title === 'string' &&
        typeof item.done === 'boolean'
    )
  );
}

{
  const three = evalWithTasks(tasksLiteral);
  check(dataShapeOk(three), 'канонический массив из трёх задач удовлетворяет форме объекта');
  equal(three.length, 3, 'канонический массив содержит три задачи');

  const fourLiteral = evalWithTasks(tasksLiteralFour);
  check(dataShapeOk(fourLiteral), 'форма «четыре объекта» удовлетворяет форме объекта');
  equal(fourLiteral.length, 4, 'форма «четыре объекта» даёт четыре задачи');
  equal(
    fourLiteral.filter((t) => t.title === 'Написать отчёт').length,
    1,
    'в форме «четыре объекта» четвёртая задача встречается ровно один раз'
  );

  const fourPush = evalWithTasks(tasksLiteralPlusPush);
  check(dataShapeOk(fourPush), 'форма «push() с объектом» удовлетворяет форме объекта');
  equal(fourPush.length, 4, 'форма «push() с объектом» даёт четыре задачи');
  equal(
    fourPush.filter((t) => t.title === 'Написать отчёт').length,
    1,
    'в форме «push() с объектом» четвёртая задача встречается ровно один раз'
  );

  // Каноническое преобразование из урока обязано давать ОБЪЕКТ, а не строку.
  // Блок «// Было / // Стало» содержит обе части: выполняем только часть
  // «// Стало» (объектный push), а «// Было» проверяем статически.
  {
    const afterMarker = pushConversion.indexOf('// Стало');
    check(
      afterMarker > 0 && pushConversion.includes('// Было'),
      'канонический блок преобразования содержит и «// Было», и «// Стало»'
    );
    const afterPart = pushConversion.slice(afterMarker).replace('// Стало', '');
    check(
      !/tasks\.push\(\s*'/.test(afterPart),
      'часть «// Стало» не содержит строкового push()'
    );
    const converted = evalWithTasks(`${tasksLiteral}\n${afterPart}`);
    check(
      dataShapeOk(converted),
      'каноническое преобразование push() из урока даёт объект-задачу, а не строку'
    );
    equal(
      converted.length,
      4,
      'каноническое преобразование добавляет ровно одну задачу'
    );
    check(
      typeof converted[3] === 'object' && converted[3] !== null,
      'элемент, добавленный каноническим преобразованием, — объект'
    );
    check(
      typeof converted[3].title === 'string' && typeof converted[3].done === 'boolean',
      'у добавленного объекта есть и title (строка), и done (логическое)'
    );
  }

  // NC-M1 — смешанные типы: новый массив объектов + старый строковый push().
  // Дефект проверяется на каноническом литерале Урока 08, поэтому он
  // обнаруживается независимо от того, какая из двух форм миграции
  // присутствует в тексте урока.
  const mixed = evalWithTasks(
    `${tasksLiteral}\ntasks.push('Повторить материал');`
  );
  equal(mixed.length, 4, 'NC-M1: длина всё равно 4 (дефект не виден по length)');
  equal(typeof mixed[3], 'string', 'NC-M1: четвёртый элемент — строка');
  equal(mixed[3].title, undefined, 'NC-M1: у четвёртого элемента нет свойства title');
  check(!dataShapeOk(mixed), 'NC-M1: проверка формы данных ДОЛЖНА провалиться на смешанных данных');

  // NC-M2 — дублирующая миграция: задача и в литерале, и через push().
  const duplicated = evalWithTasks(
    `${tasksLiteralFour}\ntasks.push({ title: 'Написать отчёт', done: false });`
  );
  equal(duplicated.length, 5, 'NC-M2: получается пять задач');
  equal(
    duplicated.filter((t) => t.title === 'Написать отчёт').length,
    2,
    'NC-M2: название четвёртой задачи дублируется'
  );
  const exactlyOnce = duplicated.filter((t) => t.title === 'Написать отчёт').length === 1;
  check(!exactlyOnce, 'NC-M2: проверка «ровно один раз» ДОЛЖНА провалиться');
}

// --- V4/V7: рендеринг списка, построенного из данных -----------------------

group('V4 рендеринг');

function listItems(list) {
  return list ? list.children.filter((child) => child.tagName === 'LI') : [];
}

{
  const three = evalWithTasks(tasksLiteral);
  const { list } = runRender(renderTaskListSource, three);
  const items = listItems(list);
  equal(items.length, 3, 'три задачи → три <li>');
  equal(
    items.map((i) => i.textContent),
    [
      'Прочитать главу — Не выполнена',
      'Сделать упражнение — Не выполнена',
      'Проверить результат — Не выполнена'
    ],
    'текст и порядок пунктов для трёх задач'
  );

  const four = evalWithTasks(tasksLiteralFour);
  const fourResult = runRender(renderTaskListSource, four);
  equal(listItems(fourResult.list).length, 4, 'четыре задачи → четыре <li>');
  equal(
    listItems(fourResult.list).map((i) => i.textContent),
    [
      'Прочитать главу — Не выполнена',
      'Сделать упражнение — Не выполнена',
      'Проверить результат — Не выполнена',
      'Написать отчёт — Не выполнена'
    ],
    'текст и порядок пунктов для четырёх задач'
  );

  const empty = evalWithTasks('const tasks = [];');
  const emptyResult = runRender(renderTaskListSource, empty);
  equal(listItems(emptyResult.list).length, 0, 'пустой массив → пустой список');

  // Состояние отражается в выводе.
  const mixedState = evalWithTasks(
    "const tasks = [{ title: 'Сделано', done: true }, { title: 'Не сделано', done: false }];"
  );
  const stateResult = runRender(renderTaskListSource, mixedState);
  equal(
    listItems(stateResult.list).map((i) => i.textContent),
    ['Сделано — Выполнена', 'Не сделано — Не выполнена'],
    'состояние задачи отражается в тексте пункта'
  );
  check(
    itemText(stateResult.list, 0) === 'Сделано — Выполнена',
    'выполненная задача помечена как «Выполнена»'
  );
  check(
    itemText(stateResult.list, 1) === 'Не сделано — Не выполнена',
    'невыполненная задача помечена как «Не выполнена»'
  );

  // Повторный вызов не дублирует пункты.
  const repeatTasks = evalWithTasks(tasksLiteral);
  const repeatFake = makeFakeDocument();
  const repeatFactory = new Function('document', 'console', 'tasks', `${renderTaskListSource}\nreturn renderTaskList;`);
  const repeatRender = repeatFactory(
    repeatFake.document,
    { log: () => {}, error: () => {} },
    repeatTasks
  );
  repeatRender();
  repeatRender();
  equal(listItems(repeatFake.registry.get('#task-list')).length, 3, 'повторный вызов не дублирует пункты');

  // Отсутствие #task-list диагностируется, а не роняет страницу.
  const missing = runRender(renderTaskListSource, three, { withTaskList: false });
  equal(missing.errors.length, 1, 'при отсутствии #task-list выводится диагностика');
  check(
    missing.errors.length === 1 && String(missing.errors[0][0]).includes('Не найден список задач'),
    'диагностика сообщает о ненайденном списке задач'
  );

  // Название с HTML-подобным текстом вставляется как ТЕКСТ.
  const htmlish = evalWithTasks(
    "const tasks = [{ title: '<b>важно</b>', done: false }];"
  );
  const htmlResult = runRender(renderTaskListSource, htmlish);
  equal(
    itemText(htmlResult.list, 0),
    '<b>важно</b> — Не выполнена',
    'HTML-подобное название вставляется как текст (textContent), а не как разметка'
  );
  check(
    !renderTaskListSource.includes('innerHTML'),
    'функция показа не использует innerHTML'
  );
}

// --- V7: список строится из данных, а не из вручную записанных позиций ------

group('V7 источник данных');

{
  check(
    !/#first-task|#second-task|#first-task-status/.test(renderTaskListSource),
    'функция показа не ищет удалённые элементы #first-task / #second-task / #first-task-status'
  );
  check(
    !/#first-task|#second-task|#first-task-status/.test(tasksPreviewHtml),
    'HTML-блок Урока 09 не содержит удалённых элементов предпросмотра'
  );
  check(tasksPreviewHtml.includes('id="task-count"'), 'счётчик задач сохранён в HTML-блоке');
  check(renderTaskListSource.includes('for (const task of tasks)'), 'список строится циклом по массиву');
  check(
    !/tasks\[0\]|tasks\[1\]|tasks\[2\]/.test(renderTaskListSource),
    'в функции показа нет вручную записанных индексов'
  );

  // Поведенческая проверка: список следует за данными.
  const dynamic = evalWithTasks(tasksLiteral);
  const dynamicResult = runRender(renderTaskListSource, dynamic);
  equal(listItems(dynamicResult.list).length, 3, 'список содержит столько пунктов, сколько задач в данных');

  dynamic.push({ title: 'Пятая', done: true });
  const dynamicAgain = runRender(renderTaskListSource, dynamic);
  equal(listItems(dynamicAgain.list).length, 4, 'после добавления задачи в данные список даёт четыре пункта');
  equal(
    itemText(dynamicAgain.list, 3),
    'Пятая — Выполнена',
    'новый пункт взят из данных и стоит в конце списка'
  );
}

// --- V2: консольное изменение не переживает перезагрузку -------------------

group('V2 исходник против состояния времени выполнения');

{
  // «Исходник» — файл на диске. «Состояние времени выполнения» — память.
  const sourceCode = tasksLiteral;
  const freshContext = () => evalWithTasks(sourceCode);

  // Изменение ТОЛЬКО в состоянии времени выполнения (как в консоли).
  const runtimeOnly = freshContext();
  runtimeOnly.push({ title: 'Написать отчёт', done: false });
  equal(runtimeOnly.length, 4, 'консольное изменение сразу видно в текущем состоянии');

  // Перезагрузка: исходник выполняется заново, в свежем контексте.
  const afterReload = freshContext();
  equal(afterReload.length, 3, 'после перезагрузки массив снова из трёх задач');
  equal(
    afterReload.filter((t) => t.title === 'Написать отчёт').length,
    0,
    'консольное изменение НЕ переживает перезагрузку неизменённого исходника'
  );

  // Изменение В ИСХОДНИКЕ — переживает перезагрузку.
  const sourceWithFourth = `${sourceCode}\ntasks.push({ title: 'Написать отчёт', done: false });`;
  const afterReloadWithFourth = evalWithTasks(sourceWithFourth);
  equal(afterReloadWithFourth.length, 4, 'изменение, записанное в исходник, переживает перезагрузку');
}

// --- V5: отрицательные контроли (внедрение ошибок) --------------------------

group('V5 отрицательные контроли');

{
  const tasks = evalWithTasks(tasksLiteral);

  // NC-D1: показываются только первые две задачи.
  const onlyFirstTwo = `
    function renderTaskList() {
      const list = document.querySelector('#task-list');
      if (!list) { console.error('Не найден список задач'); return; }
      list.textContent = '';
      for (const task of tasks.slice(0, 2)) {
        const item = document.createElement('li');
        item.textContent = task.title + ' — Не выполнена';
        list.appendChild(item);
      }
    }
  `;
  const d1 = runRender(onlyFirstTwo, tasks);
  check(listItems(d1.list).length !== 3, 'NC-D1: показ только двух задач ДОЛЖЕН ломать проверку «три пункта»');

  // NC-D2: неверный статус (все задачи помечены выполненными).
  const wrongStatus = `
    function renderTaskList() {
      const list = document.querySelector('#task-list');
      if (!list) { console.error('Не найден список задач'); return; }
      list.textContent = '';
      for (const task of tasks) {
        const item = document.createElement('li');
        item.textContent = task.title + ' — Выполнена';
        list.appendChild(item);
      }
    }
  `;
  const d2 = runRender(wrongStatus, tasks);
  check(
    itemText(d2.list, 0) !== 'Прочитать главу — Не выполнена',
    'NC-D2: неверный статус ДОЛЖЕН ломать проверку статуса'
  );

  // NC-D3: пункты накапливаются при повторном вызове (нет очистки).
  const accumulating = `
    function renderTaskList() {
      const list = document.querySelector('#task-list');
      if (!list) { console.error('Не найден список задач'); return; }
      for (const task of tasks) {
        const item = document.createElement('li');
        item.textContent = task.title + ' — Не выполнена';
        list.appendChild(item);
      }
    }
  `;
  const accFake = makeFakeDocument();
  const accFactory = new Function('document', 'console', 'tasks', `${accumulating}\nreturn renderTaskList;`);
  const accRender = accFactory(accFake.document, { log: () => {}, error: () => {} }, tasks);
  accRender();
  accRender();
  check(
    listItems(accFake.registry.get('#task-list')).length !== 3,
    'NC-D3: накопление пунктов при повторном вызове ДОЛЖНО ломать проверку «без дублей»'
  );

  // NC-D4: строковая задача принимается за объект-задачу.
  const stringTask = evalWithTasks(`${tasksLiteral}\ntasks.push('Повторить материал');`);
  const d4 = runRender(renderTaskListSource, stringTask);
  check(
    !dataShapeOk(stringTask),
    'NC-D4: строковый четвёртый элемент ДОЛЖЕН ломать проверку формы данных'
  );
  check(
    listItems(d4.list).length !== 4 || String(itemText(d4.list, 3)).includes('undefined'),
    'NC-D4: строковый элемент ДОЛЖЕН ломать проверку «четыре корректных пункта»'
  );
}

// ---------------------------------------------------------------------------
// Итог
// ---------------------------------------------------------------------------

console.log('');
console.log('=== check-lessons-08-09 ===');
console.log(`Пройдено утверждений: ${passed}`);
console.log(`Провалено утверждений: ${failures.length}`);

if (failures.length > 0) {
  console.log('');
  for (const failure of failures) {
    console.log(`FAIL: ${failure}`);
  }
  console.log('');
  console.log('РЕЗУЛЬТАТ: FAIL');
  process.exitCode = 1;
} else {
  console.log('');
  console.log('РЕЗУЛЬТАТ: PASS');
}
