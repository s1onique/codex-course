#!/usr/bin/env node
/**
 * Инструкторский smoke-тест для Урока 10.
 *
 * ЗАПУСК (из корня репозитория, стандартный Node.js, без установки пакетов):
 *
 *     node --test tools/check-lesson-10.mjs
 *
 * Тест НЕ является частью ученического пути: ученику его запускать не нужно.
 * Он проверяет центральные контракты Урока 10:
 *   - переход состояния: false -> true по одному нажатию;
 *   - идемпотентность: повторные нажатия не меняют результат;
 *   - независимость: остальные задачи не затронуты;
 *   - защита пустого массива: исключения не бросается;
 *   - согласованность списка и показанного количества;
 *   - отсутствие дублей при повторном показе;
 *   - единственный обработчик на кнопке;
 *   - сохранность темы, счётчика, сообщения и exampleTask.
 *
 * Канонические фрагменты кода ИЗВЛЕКАЮТСЯ из LESSON-10.md.
 * Если фрагмент не найден или найден неоднозначно — тест ПАДАЕТ с понятным
 * сообщением, а не выбирает произвольный блок.
 *
 * ГРАНИЦЫ ДОКАЗАТЕЛЬСТВ:
 *   - JS-семантика (переходы состояния, идемпотентность, защиты) исполняется
 *     в реальном Node.js.
 *   - DOM проверяется ЧЕРЕЗ ИМИТАЦИЮ минимального DOM (см. FakeDom ниже),
 *     а НЕ в настоящем браузере. Это НЕ нативное выполнение в браузере и
 *     НЕ визуальная проверка отображения.
 *   - Реальное поведение ученика в браузере НЕ измерялось.
 *
 * ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ (NC-1..NC-5) исполняют ИСПОРЧЕННЫЕ реализации и
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

const lesson10 = readFileSync(join(ROOT, 'LESSON-10.md'), 'utf8');

/**
 * Возвращает fenced-блоки ```javascript / ```html вместе с заголовком раздела,
 * в котором они находятся.
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

const jsBlocks = fencedBlocks(lesson10, 'javascript');
const htmlBlocks = fencedBlocks(lesson10, 'html');

/**
 * Находит ЕДИНСТВЕННЫЙ блок кода по предикату. Ноль или больше одного —
 * понятная ошибка (тест падает, а не выбирает произвольный блок).
 */
function uniqueBlock(blocks, predicate, description) {
  const found = blocks.filter(predicate);
  if (found.length === 0) {
    throw new Error(
      'В LESSON-10.md не найден блок: ' + description +
      ' (найдено 0 подходящих блоков из ' + blocks.length + ')'
    );
  }
  if (found.length > 1) {
    throw new Error(
      'В LESSON-10.md блок неоднозначен: ' + description +
      ' (найдено ' + found.length + ' подходящих блоков: ' +
      found.map((b) => b.context).join(' | ') + ')'
    );
  }
  return found[0].code;
}

const renderTaskListSource = uniqueBlock(
  jsBlocks,
  (block) => block.code.includes('function renderTaskList()') && block.code.includes('#task-count'),
  'каноническая функция renderTaskList(), обновляющая и список, и #task-count'
);

const completeFirstTaskSource = uniqueBlock(
  jsBlocks,
  (block) => block.code.includes('function completeFirstTask()'),
  'каноническая функция completeFirstTask()'
);

const connectButtonSource = uniqueBlock(
  jsBlocks,
  (block) => block.code.includes('addEventListener') && block.code.includes('#complete-first-task'),
  'каноническое подключение кнопки #complete-first-task'
);

const taskListHtml = uniqueBlock(
  htmlBlocks,
  (block) => block.code.includes('id="task-list"') && block.code.includes('id="task-count"'),
  'канонический HTML-блок со списком и счётчиком'
);

const completeButtonHtml = uniqueBlock(
  htmlBlocks,
  (block) => block.code.includes('id="complete-first-task"'),
  'канонический HTML-блок с кнопкой #complete-first-task'
);

// --- Статические проверки текста урока ------------------------------------

test('урок содержит канонические фрагменты', () => {
  assert.match(renderTaskListSource, /function renderTaskList\(\)/);
  assert.match(renderTaskListSource, /#task-count/);
  assert.match(renderTaskListSource, /tasks\.length/);
  assert.match(completeFirstTaskSource, /function completeFirstTask\(\)/);
  assert.match(completeFirstTaskSource, /tasks\[0\]\.done = true;/);
  assert.match(completeFirstTaskSource, /renderTaskList\(\);/);
  assert.match(completeButtonHtml, /id="complete-first-task"/);
});

test('в уроке ровно одна кнопка завершения задачи', () => {
  const occurrences = (lesson10.match(/id="complete-first-task"/g) || []).length;
  assert.equal(occurrences, 1, 'id="complete-first-task" должен встречаться в LESSON-10.md ровно один раз');
});

test('урок не вводит запрещённые понятия', () => {
  const forbidden = [
    'dataset',
    'closest(',
    'Promise',
    'async ',
    'await ',
    'class ',
    'localStorage',
    'sessionStorage'
  ];
  for (const token of forbidden) {
    const codeOnly = jsBlocks.map((b) => b.code).join('\n');
    assert.ok(
      !codeOnly.includes(token),
      'в каноническом коде Урока 10 не должно быть: ' + token
    );
  }
});

// ---------------------------------------------------------------------------
// P2 — порядок PRIMM: сначала предсказание, потом запуск
// ---------------------------------------------------------------------------

test('P2: в шаге Predict нет исполняемого кода — предсказания идут ДО запуска', () => {
  // Находим раздел «Шаг 1. Predict …» и следующий раздел «Шаг 2. Run …».
  const predictStart = lesson10.indexOf('## Шаг 1. Predict');
  const runStart = lesson10.indexOf('## Шаг 2. Run');

  assert.ok(predictStart >= 0, 'в LESSON-10.md есть раздел «Шаг 1. Predict»');
  assert.ok(runStart > predictStart, 'раздел «Шаг 2. Run» идёт после «Шаг 1. Predict»');

  const predictSection = lesson10.slice(predictStart, runStart);

  // В Predict не должно быть fenced-блока javascript, который что-то МЕНЯЕТ.
  const predictJs = fencedBlocks(predictSection, 'javascript');
  assert.equal(
    predictJs.length,
    0,
    'в шаге Predict не должно быть ни одного исполняемого блока javascript — ' +
      'предсказание должно быть записано ДО запуска'
  );

  // Шаблон для предсказаний должен быть ДО запуска.
  assert.match(
    predictSection,
    /Запишите предсказания/i,
    'в шаге Predict есть требование записать предсказания'
  );
});

test('P2: исполняемая демонстрация перенесена в Run и требует вернуть базовую линию', () => {
  const runStart = lesson10.indexOf('## Шаг 2. Run');
  const investigateStart = lesson10.indexOf('## Шаг 3. Investigate');

  assert.ok(runStart >= 0 && investigateStart > runStart, 'разделы Run и Investigate на месте');

  const runSection = lesson10.slice(runStart, investigateStart);

  // Изменение данных вручную теперь выполняется в Run, а не в Predict.
  assert.match(
    runSection,
    /tasks\[0\]\.done = true;/,
    'в шаге Run есть исполняемая демонстрация изменения данных'
  );

  // Требование вернуть исходную базовую линию из трёх задач.
  assert.match(
    runSection,
    /tasks\[0\]\.done = false;/,
    'в шаге Run требуется вернуть исходное состояние задачи'
  );
  assert.match(
    runSection,
    /базов/i,
    'в шаге Run объясняется, зачем нужна исходная базовая линия'
  );
});

test('P2: необязательная completeTaskByIndex() отклоняет не-целые номера', () => {
  const optionalBlock = uniqueBlock(
    jsBlocks,
    (block) => block.code.includes('function completeTaskByIndex('),
    'необязательная функция completeTaskByIndex()'
  );

  assert.match(
    optionalBlock,
    /Number\.isInteger\(index\)/,
    'проверка целочисленности номера обязательна'
  );

  // Функция исполняется в реальном Node.js.
  const factory = new Function(
    'document',
    'console',
    `
const tasks = [
  { title: 'Прочитать главу', done: false },
  { title: 'Сделать упражнение', done: false },
  { title: 'Проверить результат', done: false }
];
function renderTaskList() {}
${optionalBlock}
return { tasks, completeTaskByIndex };
`
  );

  const errors = [];
  const consoleStub = { log: () => {}, error: (m) => errors.push(String(m)), warn: () => {} };
  const api = factory({}, consoleStub);

  // ПРИНИМАЮТСЯ: 0, 1, 2
  for (const index of [0, 1, 2]) {
    const before = api.tasks.map((t) => t.done);
    api.completeTaskByIndex(index);
    assert.equal(
      api.tasks[index].done,
      true,
      `номер ${index} принимается — задача завершена`
    );
    assert.equal(
      api.tasks.filter((t) => t.done).length,
      before.filter(Boolean).length + 1,
      `номер ${index} меняет ровно одну задачу`
    );
  }

  // ОТКЛОНЯЮТСЯ: -1, 3, 99, 1.5, NaN, "1"
  const rejected = [-1, 3, 99, 1.5, NaN, '1'];
  for (const index of rejected) {
    const before = api.tasks.map((t) => t.done);
    const errorsBefore = errors.length;

    assert.doesNotThrow(
      () => api.completeTaskByIndex(index),
      `неверный номер ${String(index)} не бросает исключение`
    );
    assert.deepEqual(
      api.tasks.map((t) => t.done),
      before,
      `неверный номер ${String(index)} не меняет задачи`
    );
    assert.equal(
      errors.length,
      errorsBefore + 1,
      `неверный номер ${String(index)} даёт понятное сообщение в консоль`
    );
    assert.match(errors[errors.length - 1], /Неверный номер задачи/, 'сообщение ожидаемое');
  }
});

test('P2: необязательный материал Урока 10 остаётся необязательным', () => {
  assert.match(
    lesson10,
    /Шаг 5\. Make[\s\S]*?необязат/i,
    'шаг Make помечен как необязательный'
  );
  assert.match(
    lesson10,
    /необязательн/i,
    'в уроке есть явные пометки необязательности'
  );
});

// ---------------------------------------------------------------------------
// ИМИТАЦИЯ МИНИМАЛЬНОГО DOM
// ---------------------------------------------------------------------------

/**
 * Минимальная имитация DOM. Это НЕ браузер и НЕ визуальная проверка:
 * здесь нет layout, нет CSS, нет настоящего рендеринга.
 * Есть только то, что использует канонический код урока:
 *   - элемент с textContent и appendChild;
 *   - document.querySelector по id;
 *   - document.createElement;
 *   - addEventListener / диспетчеризация click.
 */
function makeFakeDocument(ids) {
  const registry = new Map();

  function makeElement(tagName, id) {
    const children = [];
    const listeners = [];
    let text = '';
    const classes = new Set();
    const element = {
      tagName: String(tagName).toUpperCase(),
      id: id || '',
      children,
      listeners,
      /** Минимальный classList: достаточно toggle() для переключателя темы. */
      classList: {
        toggle(name) {
          if (classes.has(name)) {
            classes.delete(name);
            return false;
          }
          classes.add(name);
          return true;
        },
        contains(name) {
          return classes.has(name);
        }
      },
      /**
       * Установка textContent = '' очищает и текст, и дочерние элементы —
       * как в настоящем DOM. Это делает очистку списка перед заполнением
       * наблюдаемой, а не декоративной.
       */
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
      /**
       * Регистрация обработчика с НАСТОЯЩИМИ правилами native EventTarget:
       *   - тот же тип события, тот же объект-функция и тот же флаг capture —
       *     повторная регистрация ИГНОРИРУЕТСЯ (дубликат не добавляется);
       *   - два разных объекта-функции — это два разных обработчика,
       *     и оба выполняются при отправке события.
       *
       * До ACT-12 имитация безусловно добавляла обработчик, из-за чего
       * ошибочно считала, что одинаковая функция зарегистрирована дважды.
       * Семантика сверена с native EventTarget (см. тест «нативная семантика…»).
       */
      addEventListener(type, handler, options) {
        const capture = Boolean(
          options && typeof options === 'object' ? options.capture : options
        );

        const alreadyRegistered = listeners.some(
          (l) => l.type === type && l.handler === handler && l.capture === capture
        );

        if (alreadyRegistered) {
          return;
        }

        listeners.push({ type, handler, capture });
      },
      /** Имитация нажатия: вызывает ВСЕ зарегистрированные обработчики. */
      click() {
        for (const listener of listeners) {
          if (listener.type === 'click') {
            listener.handler();
          }
        }
      },
      /**
       * Отправка события произвольного типа — как native EventTarget.
       * Вызываются все зарегистрированные обработчики этого типа.
       */
      dispatchEvent(type) {
        for (const listener of listeners) {
          if (listener.type === type) {
            listener.handler();
          }
        }
      },
      /** Сколько обработчиков клика зарегистрировано на элементе. */
      clickListenerCount() {
        return listeners.filter((l) => l.type === 'click').length;
      },
      /** Сколько обработчиков события данного типа зарегистрировано. */
      listenerCount(type) {
        return listeners.filter((l) => l.type === type).length;
      }
    };
    return element;
  }

  for (const id of ids) {
    const element = makeElement(id.startsWith('#') ? 'span' : 'div', id.replace('#', ''));
    // Начальное содержимое — как в разметке урока: «Всего задач: —».
    if (id === '#task-count') {
      element.textContent = '—';
    }
    registry.set(id, element);
  }

  const body = makeElement('body', '');

  const document = {
    registry,
    body,
    querySelector(selector) {
      if (typeof selector !== 'string' || !selector.startsWith('#')) {
        return null;
      }
      return registry.get(selector) || null;
    },
    createElement(tagName) {
      return makeElement(tagName, '');
    }
  };

  return { document, registry };
}

/** Создаёт реестр элементов для типичной страницы Урока 10. */
function makePage(ids) {
  const fake = makeFakeDocument(ids);
  const errors = [];
  const consoleStub = {
    log: () => {},
    error: (message) => errors.push(String(message)),
    warn: () => {}
  };
  return { ...fake, errors, consoleStub };
}

/** Тексты всех <li> внутри #task-list. */
function listItems(list) {
  if (!list) {
    return [];
  }
  return list.children;
}

/** Текст пункта списка по индексу. */
function itemText(list, index) {
  const items = listItems(list);
  return items[index] ? items[index].textContent : null;
}

/** Значение, показанное в #task-count. */
function shownCount(page) {
  const count = page.registry.get('#task-count');
  return count ? count.textContent : null;
}

// ---------------------------------------------------------------------------
// СЕМАНТИКА РЕГИСТРАЦИИ ОБРАБОТЧИКОВ: сверка с native EventTarget
//
// Имитация DOM обязана вести себя как настоящий EventTarget в тех случаях,
// которые проверяет курс. Эталон — НАСТОЯЩИЙ EventTarget из Node.js:
// он не является имитацией и не зависит от кода этого репозитория.
// ---------------------------------------------------------------------------

test('нативная семантика EventTarget: одинаковая функция — один вызов', () => {
  const target = new EventTarget();
  let calls = 0;

  function handler() {
    calls += 1;
  }

  target.addEventListener('test', handler);
  target.addEventListener('test', handler);

  target.dispatchEvent(new Event('test'));

  assert.equal(calls, 1, 'native EventTarget вызывает одинаковый обработчик один раз');
});

test('нативная семантика EventTarget: две разные функции — два вызова', () => {
  const target = new EventTarget();
  let calls = 0;

  target.addEventListener('test', function () {
    calls += 1;
  });

  target.addEventListener('test', function () {
    calls += 1;
  });

  target.dispatchEvent(new Event('test'));

  assert.equal(calls, 2, 'native EventTarget вызывает два разных обработчика');
});

test('нативная семантика EventTarget совпадает с имитацией DOM', () => {
  // Эталон: настоящий EventTarget.
  const nativeTarget = new EventTarget();
  let nativeCalls = 0;
  function nativeHandler() {
    nativeCalls += 1;
  }
  nativeTarget.addEventListener('test', nativeHandler);
  nativeTarget.addEventListener('test', nativeHandler);
  nativeTarget.dispatchEvent(new Event('test'));

  assert.equal(nativeCalls, 1, 'эталон: одинаковая функция — один вызов');

  // Имитация DOM: тот же сценарий.
  const page = makePage(['#probe']);
  const element = page.registry.get('#probe');

  let fakeCalls = 0;
  function fakeHandler() {
    fakeCalls += 1;
  }
  element.addEventListener('test', fakeHandler);
  element.addEventListener('test', fakeHandler);
  element.dispatchEvent('test');

  assert.equal(fakeCalls, nativeCalls, 'имитация совпадает с эталоном по одинаковой функции');
  assert.equal(element.listenerCount('test'), 1, 'дубликат одинаковой функции не регистрируется дважды');
});

test('имитация DOM совпадает с эталоном по двум разным функциям', () => {
  // Эталон: настоящий EventTarget.
  const nativeTarget = new EventTarget();
  let nativeCalls = 0;
  nativeTarget.addEventListener('test', function () {
    nativeCalls += 1;
  });
  nativeTarget.addEventListener('test', function () {
    nativeCalls += 1;
  });
  nativeTarget.dispatchEvent(new Event('test'));

  assert.equal(nativeCalls, 2, 'эталон: две разные функции — два вызова');

  // Имитация DOM: тот же сценарий.
  const page = makePage(['#probe']);
  const element = page.registry.get('#probe');

  let fakeCalls = 0;
  element.addEventListener('test', function () {
    fakeCalls += 1;
  });
  element.addEventListener('test', function () {
    fakeCalls += 1;
  });
  element.dispatchEvent('test');

  assert.equal(fakeCalls, nativeCalls, 'имитация совпадает с эталоном по двум разным функциям');
  assert.equal(element.listenerCount('test'), 2, 'две разные функции — два зарегистрированных обработчика');
});

/**
 * Собирает исполняемое приложение из КАНОНИЧЕСКОГО кода урока.
 *
 * completeSource / renderSource можно подменить, чтобы получить
 * испорченную реализацию для отрицательного контроля.
 */
function buildApp(options = {}) {
  const {
    tasksLiteral = "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }];",
    completeSource = completeFirstTaskSource,
    renderSource = renderTaskListSource,
    connectSource = connectButtonSource,
    ids = ['#task-list', '#task-count', '#complete-first-task', '#click-button', '#theme-button', '#message', '#example-status']
  } = options;

  const page = makePage(ids);

  const source = `
${tasksLiteral}

${renderSource}

${completeSource}

${connectSource}
`;

  const factory = new Function(
    'document',
    'console',
    `${source}
return { tasks, renderTaskList, completeFirstTask };`
  );

  const api = factory(page.document, page.consoleStub);

  return { page, api, tasks: api.tasks };
}

// ---------------------------------------------------------------------------
// V3 — переходы состояния
// ---------------------------------------------------------------------------

test('V3: начальное состояние false, первое завершение даёт true', () => {
  const { api, tasks, page } = buildApp();

  api.renderTaskList();
  assert.equal(tasks[0].done, false, 'до нажатия done === false');
  assert.equal(itemText(page.registry.get('#task-list'), 0), 'Прочитать главу — Не выполнена');

  page.registry.get('#complete-first-task').click();

  assert.equal(tasks[0].done, true, 'после первого нажатия done === true');
  assert.equal(itemText(page.registry.get('#task-list'), 0), 'Прочитать главу — Выполнена');
});

test('V3: повторные нажатия идемпотентны', () => {
  const { api, tasks, page } = buildApp();
  const button = page.registry.get('#complete-first-task');

  button.click();
  button.click();
  button.click();

  assert.equal(tasks[0].done, true, 'после трёх нажатий done === true');
  assert.equal(itemText(page.registry.get('#task-list'), 0), 'Прочитать главу — Выполнена');
  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'список не продублировался');
});

test('V3: другие задачи не меняются', () => {
  const { api, tasks, page } = buildApp();

  page.registry.get('#complete-first-task').click();

  assert.equal(tasks[1].done, false, 'вторая задача не изменилась');
  assert.equal(tasks[2].done, false, 'третья задача не изменилась');
  assert.equal(itemText(page.registry.get('#task-list'), 1), 'Сделать упражнение — Не выполнена');
  assert.equal(itemText(page.registry.get('#task-list'), 2), 'Проверить результат — Не выполнена');
});

test('V3: уже выполненная задача остаётся выполненной', () => {
  const { api, tasks, page } = buildApp({
    tasksLiteral: "const tasks = [{ title: 'Прочитать главу', done: true }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }];"
  });

  page.registry.get('#complete-first-task').click();

  assert.equal(tasks[0].done, true, 'done остался true');
  assert.equal(itemText(page.registry.get('#task-list'), 0), 'Прочитать главу — Выполнена');
  assert.equal(tasks[1].done, false, 'вторая задача не изменилась');
});

test('V3: пустой массив не приводит к исключению', () => {
  const { api, page } = buildApp({
    tasksLiteral: 'const tasks = [];'
  });

  assert.doesNotThrow(() => {
    page.registry.get('#complete-first-task').click();
  }, 'пустой массив не должен бросать исключение');

  assert.deepEqual(page.errors, ['Нет задач для завершения'], 'в консоль ушло понятное сообщение');
});

test('V3: перезагрузка из неизменённого источника восстанавливает начальное состояние', () => {
  const first = buildApp();
  first.page.registry.get('#complete-first-task').click();
  assert.equal(first.tasks[0].done, true);

  // «Перезагрузка»: исходный код выполняется заново из того же файла,
  // и при загрузке страница снова показывает список.
  const reloaded = buildApp();
  reloaded.api.renderTaskList();
  assert.equal(reloaded.tasks[0].done, false, 'после перезагрузки done снова false');
  assert.equal(
    itemText(reloaded.page.registry.get('#task-list'), 0),
    'Прочитать главу — Не выполнена',
    'после перезагрузки надпись снова «Не выполнена»'
  );
});


// ---------------------------------------------------------------------------
// V4 — показ
// ---------------------------------------------------------------------------

test('V4: список и количество согласованы при загрузке', () => {
  const { api, page } = buildApp();
  api.renderTaskList();

  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'три пункта списка');
  assert.equal(shownCount(page), '3', 'показано «Всего задач: 3»');
});

test('V4: добавление задачи и повторный показ обновляют и список, и количество', () => {
  const { api, tasks, page } = buildApp();
  api.renderTaskList();

  tasks.push({ title: 'Написать отчёт', done: false });
  api.renderTaskList();

  assert.equal(listItems(page.registry.get('#task-list')).length, 4, 'четыре пункта списка');
  assert.equal(shownCount(page), '4', 'показано «Всего задач: 4»');
  assert.equal(itemText(page.registry.get('#task-list'), 3), 'Написать отчёт — Не выполнена');
});

test('V4: повторный показ без изменений ничего не ломает и не дублирует', () => {
  const { api, page } = buildApp();
  api.renderTaskList();
  api.renderTaskList();
  api.renderTaskList();

  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'по-прежнему три пункта');
  assert.equal(shownCount(page), '3', 'количество прежнее');
});

test('V4: пустой массив и повторный показ дают ноль пунктов и «0»', () => {
  const { api, page } = buildApp({ tasksLiteral: 'const tasks = [];' });
  api.renderTaskList();

  assert.equal(listItems(page.registry.get('#task-list')).length, 0, 'ни одного пункта');
  assert.equal(shownCount(page), '0', 'показано «Всего задач: 0»');
});

test('V4: отсутствие обязательных элементов даёт диагностику, а не исключение', () => {
  const { api, page } = buildApp({ ids: ['#complete-first-task'] });

  assert.doesNotThrow(() => api.renderTaskList(), 'показ без списка не должен бросать исключение');
  assert.ok(
    page.errors.some((message) => message.includes('Не найден список задач')),
    'в консоль ушло сообщение об отсутствии списка: ' + JSON.stringify(page.errors)
  );
});

test('V4: названия с HTML-подобным текстом остаются текстом', () => {
  const { api, page } = buildApp({
    tasksLiteral: "const tasks = [{ title: '<b>важно</b>', done: false }];"
  });
  api.renderTaskList();

  assert.equal(
    itemText(page.registry.get('#task-list'), 0),
    '<b>важно</b> — Не выполнена',
    'название записано текстом, а не разметкой'
  );
});

test('V4: изменение состояния без показа оставляет старый текст', () => {
  const { api, tasks, page } = buildApp();
  api.renderTaskList();

  tasks[0].done = true;

  assert.equal(tasks[0].done, true, 'данные изменились');
  assert.equal(
    itemText(page.registry.get('#task-list'), 0),
    'Прочитать главу — Не выполнена',
    'без повторного показа текст остался прежним'
  );
});

test('V4: показ без изменения состояния не завершает задачу', () => {
  const { api, tasks, page } = buildApp();
  api.renderTaskList();

  api.renderTaskList();

  assert.equal(tasks[0].done, false, 'показ не меняет состояние');
  assert.equal(itemText(page.registry.get('#task-list'), 0), 'Прочитать главу — Не выполнена');
});


// ---------------------------------------------------------------------------
// V5 — интеграция: существующая функциональность сохранена
// ---------------------------------------------------------------------------

/**
 * Репрезентативный код Урока 05–09: счётчик, сообщение, тема, пример задачи.
 * Он проверяется ВМЕСТЕ с каноническим кодом Урока 10.
 *
 * ВАЖНО (исправлено в ACT-12). Раньше здесь стояла выдуманная реализация:
 *
 *     function achievementMessage() {
 *       if (clicks > 5) { return 'Цель достигнута!'; }
 *       return 'Продолжайте';
 *     }
 *
 * Это НЕ канонический код более ранних уроков: порог 5 вместо 3 и
 * сообщение без восклицательного знака. Прежний интеграционный тест
 * проверял именно эту подделку, поэтому «сохранность существующей
 * функциональности» не была доказана.
 *
 * Канонический источник — LESSON-05.md, блок «Конечный обрабатываемый
 * кусок» (и происхождение правила — LESSON-04.md, шаг с `clicks >= 3`):
 *
 *     function achievementMessage(count) {
 *       if (count >= 3) { return 'Цель достигнута!'; }
 *       else { return 'Продолжайте!'; }
 *     }
 *
 * Ниже — канонический код с небольшими поправками на имена элементов
 * тестовой страницы (#click-count вместо #counter) и на добавленные
 * в Уроке 03 упражнение points и в Уроке 07 блок «Пример задачи».
 * Порог, обе строки сообщения и порядок вызовов — из LESSON-05.md.
 */
const LEGACY_SOURCE = `
let clicks = 0;
let points = 0;
const exampleTask = { title: 'Составить план', done: false };

function achievementMessage(count) {
  if (count >= 3) {
    return 'Цель достигнута!';
  } else {
    return 'Продолжайте!';
  }
}

function startCounter() {
  const counter = document.querySelector('#click-count');
  const message = document.querySelector('#message');
  const theme = document.querySelector('#theme-button');
  const exampleStatus = document.querySelector('#example-status');

  const button = document.querySelector('#click-button');

  if (button) {
    button.addEventListener('click', function () {
      clicks = clicks + 1;
      points = points + 2;

      if (counter) {
        counter.textContent = String(clicks);
      }

      if (message) {
        message.textContent = achievementMessage(clicks);
      }

      if (exampleStatus) {
        exampleStatus.textContent = exampleTask.done ? 'Выполнена' : 'Не выполнена';
      }
    });
  }

  if (theme) {
    theme.addEventListener('click', function () {
      document.body.classList.toggle('dark');
    });
  }

  renderTaskList();
}
`;

/**
 * Собирает приложение, где Урок 10 дописан к существующему коду Урока 08–09.
 * Инициализация вызывается один раз — как на настоящей странице.
 */
function buildIntegratedApp(options = {}) {
  const {
    tasksLiteral = "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }];",
    completeSource = completeFirstTaskSource,
    renderSource = renderTaskListSource,
    connectSource = connectButtonSource
  } = options;

  const page = makePage([
    '#task-list',
    '#task-count',
    '#complete-first-task',
    '#click-button',
    '#click-count',
    '#message',
    '#theme-button',
    '#example-status'
  ]);

  const source = `
${tasksLiteral}

${LEGACY_SOURCE}

${renderSource}

${completeSource}

${connectSource}

startCounter();
`;

  const factory = new Function(
    'document',
    'console',
    `${source}
return { tasks, exampleTask, renderTaskList, completeFirstTask, achievementMessage, startCounter };`
  );

  const api = factory(page.document, page.consoleStub);
  return { page, api, tasks: api.tasks };
}

test('V5: канонические три задачи, список и количество согласованы', () => {
  const { page, tasks } = buildIntegratedApp();

  assert.equal(tasks.length, 3, 'три задачи');
  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'три пункта списка');
  assert.equal(shownCount(page), '3', 'показано «Всего задач: 3»');
});

test('V5: необязательная четвёртая задача учитывается в списке и количестве', () => {
  const { page, tasks } = buildIntegratedApp({
    tasksLiteral: "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }, { title: 'Написать отчёт', done: false }];"
  });

  assert.equal(tasks.length, 4, 'четыре задачи');
  assert.equal(listItems(page.registry.get('#task-list')).length, 4, 'четыре пункта списка');
  assert.equal(shownCount(page), '4', 'показано «Всего задач: 4»');
});

test('V5: необязательное упражнение points продолжает работать', () => {
  const { page } = buildIntegratedApp();
  const button = page.registry.get('#click-button');

  button.click();
  button.click();
  button.click();

  assert.equal(page.registry.get('#click-count').textContent, '3', 'счётчик показывает 3');
  assert.equal(page.registry.get('#message').textContent, 'Цель достигнута!', 'сообщение прежнее');
});

test('V5: сообщение «Цель достигнута!» и переключение темы не сломаны', () => {
  const { page, api } = buildIntegratedApp();
  const button = page.registry.get('#click-button');

  for (let i = 0; i < 6; i += 1) {
    button.click();
  }

  assert.equal(page.registry.get('#message').textContent, 'Цель достигнута!', 'сообщение достигнуто');
  assert.equal(api.achievementMessage(6), 'Цель достигнута!', 'функция achievementMessage работает');

  page.registry.get('#theme-button').click();
  assert.equal(page.registry.get('#theme-button').clickListenerCount(), 1, 'на кнопке темы один обработчик');
});

test('V5: контракт сообщения о достижении цели — как в Уроке 05 (порог 3)', () => {
  // Канонический контракт из LESSON-05.md:
  //   achievementMessage(count): count >= 3 -> 'Цель достигнута!', иначе 'Продолжайте!'
  const { page, api } = buildIntegratedApp();
  const button = page.registry.get('#click-button');

  assert.equal(api.achievementMessage(0), 'Продолжайте!', '0 кликов — «Продолжайте!»');
  assert.equal(api.achievementMessage(2), 'Продолжайте!', '2 клика — «Продолжайте!»');
  assert.equal(api.achievementMessage(3), 'Цель достигнута!', '3 клика — «Цель достигнута!»');
  assert.equal(api.achievementMessage(4), 'Цель достигнута!', '4 клика — «Цель достигнута!»');

  // То же самое — через реальное нажатие на кнопку счётчика.
  button.click();
  button.click();
  assert.equal(page.registry.get('#message').textContent, 'Продолжайте!', 'после 2 кликов — «Продолжайте!»');

  button.click();
  assert.equal(page.registry.get('#message').textContent, 'Цель достигнута!', 'после 3 кликов — «Цель достигнута!»');

  button.click();
  assert.equal(page.registry.get('#message').textContent, 'Цель достигнута!', 'после 4 кликов — «Цель достигнута!»');
});

test('V5: завершение задачи НЕ меняет счётчик, порог, сообщение, тему и exampleTask', () => {
  const { page, api, tasks } = buildIntegratedApp();
  const button = page.registry.get('#click-button');

  button.click();
  button.click();
  button.click();

  const messageBefore = page.registry.get('#message').textContent;
  const countBefore = page.registry.get('#click-count').textContent;

  assert.equal(messageBefore, 'Цель достигнута!', 'до завершения задачи сообщение достигнуто');

  // Завершаем задачу.
  page.registry.get('#complete-first-task').click();

  assert.equal(tasks[0].done, true, 'задача завершена');
  assert.equal(page.registry.get('#click-count').textContent, countBefore, 'счётчик кликов не изменился');
  assert.equal(page.registry.get('#message').textContent, messageBefore, 'сообщение не изменилось');
  assert.equal(api.achievementMessage(3), 'Цель достигнута!', 'порог сообщения прежний');
  assert.equal(api.exampleTask.done, false, 'exampleTask не изменился');
  assert.equal(
    page.registry.get('#example-status').textContent,
    'Не выполнена',
    'блок «Пример задачи» прежний'
  );

  // Тема переключается как раньше.
  page.registry.get('#theme-button').click();
  assert.equal(page.registry.get('#theme-button').clickListenerCount(), 1, 'на кнопке темы один обработчик');
});

test('V5: независимый exampleTask не затрагивается', () => {
  const { page, api, tasks } = buildIntegratedApp();

  // Блок «Пример задачи» заполняется при нажатии кнопки счётчика.
  page.registry.get('#click-button').click();
  page.registry.get('#complete-first-task').click();

  assert.equal(api.exampleTask.done, false, 'exampleTask не изменился');
  assert.equal(page.registry.get('#example-status').textContent, 'Не выполнена', 'блок примера прежний');
  assert.equal(tasks[0].done, true, 'первая задача завершена');
});

test('V5: переключение темы и счётчик не ломаются после завершения задачи', () => {
  const { page } = buildIntegratedApp();

  page.registry.get('#complete-first-task').click();
  page.registry.get('#click-button').click();

  assert.equal(page.registry.get('#click-count').textContent, '1', 'счётчик работает');
  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'список прежний');
});


// ---------------------------------------------------------------------------
// ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ
//
// Каждый контроль ИСПОЛНЯЕТ испорченную реализацию и проверяет, что
// соответствующая проверка действительно ломается. Ни один контроль не
// ограничивается просмотром строк исходного текста.
// ---------------------------------------------------------------------------

test('NC-0: ПРЕЖДЯЯ интеграционная фикстура не проходит трёхкликовый критерий Урока 05', () => {
  // Исполняем СТАРУЮ (испорченную) фикстуру из ACT-11:
  //   порог `clicks > 5` и сообщение 'Продолжайте' без восклицательного знака.
  // Проверка ниже — это критерий более раннего урока (LESSON-05.md):
  // на третьем нажатии сообщение должно стать 'Цель достигнута!'.

  const OLD_LEGACY_SOURCE = `
let clicks = 0;
const exampleTask = { title: 'Составить план', done: false };

function achievementMessage() {
  if (clicks > 5) {
    return 'Цель достигнута!';
  }
  return 'Продолжайте';
}

function startCounter() {
  const counter = document.querySelector('#click-count');
  const message = document.querySelector('#message');
  const button = document.querySelector('#click-button');

  if (button) {
    button.addEventListener('click', function () {
      clicks = clicks + 1;
      if (counter) { counter.textContent = String(clicks); }
      if (message) { message.textContent = achievementMessage(); }
    });
  }
}
`;

  const page = makePage(['#click-count', '#message', '#click-button']);

  const factory = new Function(
    'document',
    'console',
    `${OLD_LEGACY_SOURCE}
     startCounter();
     return { achievementMessage };`
  );
  const api = factory(page.document, page.consoleStub);

  const button = page.registry.get('#click-button');
  button.click();
  button.click();
  button.click();

  // Критерий Урока 05: после трёх нажатий — 'Цель достигнута!'.
  const shown = page.registry.get('#message').textContent;

  assert.notEqual(shown, 'Цель достигнута!', 'старая фикстура обязана провалить трёхкликовый критерий');
  assert.equal(shown, 'Продолжайте', 'старая фикстура показывает устаревшее сообщение');
  assert.notEqual(shown, 'Продолжайте!', 'старая фикстура теряет восклицательный знак');

  // И функция тоже: на третьем клике она ещё не выдаёт достижение.
  assert.notEqual(api.achievementMessage(), 'Цель достигнута!', 'функция старой фикстуры не знает порога 3');
});

test('NC-0b: исправленная фикстура проходит трёхкликовый критерий Урока 05', () => {
  // Тот же критерий против исправленной (канонической) фикстуры.
  const { page, api } = buildIntegratedApp();
  const button = page.registry.get('#click-button');

  button.click();
  button.click();
  button.click();

  assert.equal(page.registry.get('#message').textContent, 'Цель достигнута!', 'после 3 кликов — «Цель достигнута!»');
  assert.equal(api.achievementMessage(3), 'Цель достигнута!', 'функция отдаёт тот же контракт');
});

test('NC-1: без вызова renderTaskList() проверка состояния на экране ломается', () => {
  // Убираем вызов показа после изменения данных.
  const broken = completeFirstTaskSource.replace(/\n\s*renderTaskList\(\);/, '');

  assert.notEqual(broken, completeFirstTaskSource, 'вызов renderTaskList() действительно удалён');

  const { api, tasks, page } = buildApp({ completeSource: broken });
  api.renderTaskList();
  page.registry.get('#complete-first-task').click();

  // Данные изменились…
  assert.equal(tasks[0].done, true, 'данные изменились');
  // …а на экране остался старый текст: проверка состояния на экране ЛОМАЕТСЯ.
  const shown = itemText(page.registry.get('#task-list'), 0);
  assert.notEqual(shown, 'Прочитать главу — Выполнена', 'на экране должно остаться «Не выполнена»');
  assert.equal(shown, 'Прочитать главу — Не выполнена', 'текст на экране устарел');
});

test('NC-2: при изменении tasks[1] ожидание по первой задаче ломается', () => {
  const broken = completeFirstTaskSource.replace('tasks[0].done = true;', 'tasks[1].done = true;');

  assert.notEqual(broken, completeFirstTaskSource, 'индекс изменён на tasks[1]');

  const { api, tasks, page } = buildApp({ completeSource: broken });
  api.renderTaskList();
  page.registry.get('#complete-first-task').click();

  assert.equal(tasks[1].done, true, 'вторая задача действительно завершена');
  assert.equal(tasks[0].done, false, 'первая задача осталась невыполненной');

  const shownFirst = itemText(page.registry.get('#task-list'), 0);
  assert.notEqual(shownFirst, 'Прочитать главу — Выполнена', 'ожидание по первой задаче должно сломаться');
  assert.equal(shownFirst, 'Прочитать главу — Не выполнена', 'первая задача не завершена');
});

test('NC-3: два РАЗНЫХ обработчика на кнопке ломают контракт числа подписок', () => {
  // ДЕФЕКТ, который раньше проверялся неверно.
  //
  // Прежний контроль регистрировал ОДНУ И ТУ ЖЕ функцию
  // completeFirstTask два раза. Настоящий EventTarget такую повторную
  // регистрацию ИГНОРИРУЕТСЯ (см. тест про native EventTarget выше),
  // поэтому такой «дубль» не является дубликатом обработчика и не может
  // доказывать, что контракт «один обработчик» что-то ловит.
  //
  // Исправленный контроль регистрирует ДВЕ РАЗНЫЕ функции-обёртки.
  // Это настоящий дубликат: и native EventTarget, и имитация DOM считают
  // их двумя разными обработчиками.
  const duplicated = connectButtonSource.replace(
    /completeButton\.addEventListener\('click', completeFirstTask\);/,
    [
      "completeButton.addEventListener('click', function () {",
      '  completeFirstTask();',
      '});',
      '',
      "completeButton.addEventListener('click', function () {",
      '  completeFirstTask();',
      '});'
    ].join('\n')
  );

  assert.notEqual(duplicated, connectButtonSource, 'обработчик действительно продублирован');

  const { api, tasks, page } = buildApp({ connectSource: duplicated });
  const button = page.registry.get('#complete-first-task');

  assert.equal(button.clickListenerCount(), 2, 'на кнопке два обработчика');

  // Итоговое состояние НЕ отличает дублирование: задача и так станет выполненной.
  api.renderTaskList();
  button.click();
  assert.equal(tasks[0].done, true, 'состояние всё равно выполнено — дублирование скрыто в результате');

  // Ломается именно контракт числа подписок.
  assert.notEqual(button.clickListenerCount(), 1, 'контракт «один обработчик» должен сломаться');
});

test('NC-3b: ОДИНАКОВАЯ функция, зарегистрированная дважды, дубликатом НЕ является', () => {
  // Контроль на ложное срабатывание: настоящий EventTarget игнорирует
  // повторную регистрацию той же функции, поэтому число обработчиков
  // остаётся равным 1 и контракт «один обработчик» НЕ ломается.
  const duplicated = connectButtonSource.replace(
    /completeButton\.addEventListener\('click', completeFirstTask\);/,
    "completeButton.addEventListener('click', completeFirstTask);\n    completeButton.addEventListener('click', completeFirstTask);"
  );

  assert.notEqual(duplicated, connectButtonSource, 'повторная регистрация действительно добавлена');

  const { page } = buildApp({ connectSource: duplicated });
  const button = page.registry.get('#complete-first-task');

  assert.equal(button.clickListenerCount(), 1, 'одинаковая функция считается одним обработчиком');
});

test('NC-4: показ списка без обновления количества ломает согласованность', () => {
  // Убираем обновление #task-count из renderTaskList().
  const broken = renderTaskListSource.replace(
    /const count = document\.querySelector\('#task-count'\);[\s\S]*?}\n/,
    ''
  );

  assert.notEqual(broken, renderTaskListSource, 'обновление #task-count действительно удалено');

  const { api, tasks, page } = buildApp({ renderSource: broken });
  api.renderTaskList();

  tasks.push({ title: 'Написать отчёт', done: false });
  api.renderTaskList();

  const items = listItems(page.registry.get('#task-list')).length;
  const count = shownCount(page);

  assert.equal(items, 4, 'в списке четыре пункта');
  assert.notEqual(count, '4', 'показанное количество обязано разойтись со списком');
  assert.equal(count, '—', 'количество не обновилось — согласованность сломана');
});

test('NC-5: без защиты пустого массива исключение ломает требование «без ошибки»', () => {
  const broken = completeFirstTaskSource.replace(
    /if \(tasks\.length === 0\) \{[\s\S]*?\n  \}\n/,
    ''
  );

  assert.notEqual(broken, completeFirstTaskSource, 'защита пустого массива действительно удалена');

  const { page } = buildApp({
    completeSource: broken,
    tasksLiteral: 'const tasks = [];'
  });

  let thrown = null;
  try {
    page.registry.get('#complete-first-task').click();
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown !== null, 'испорченная реализация обязана бросать исключение');
  assert.match(String(thrown && thrown.message), /undefined|Cannot read/i, 'ожидаемая ошибка доступа к undefined');
});

test('NC-5b: каноническая реализация на пустом массиве исключения не бросает', () => {
  const { page } = buildApp({ tasksLiteral: 'const tasks = [];' });

  assert.doesNotThrow(() => page.registry.get('#complete-first-task').click());
  assert.deepEqual(page.errors, ['Нет задач для завершения']);
});



// ---------------------------------------------------------------------------
// P2 — миграция Урока 09: устаревшие обращения должны быть УДАЛЕНЫ
//
// Здесь строится репрезентативное приложение Урока 08, к нему применяются
// инструкции Урока 09, и затем проверяется РЕЗУЛЬТАТ: в HTML и в JavaScript
// не осталось обращений к #first-task, #second-task и #first-task-status.
// Проверка только самой функции renderTaskList() была бы недостаточна.
// ---------------------------------------------------------------------------

const lesson09 = readFileSync(join(ROOT, 'LESSON-09.md'), 'utf8');

/** Репрезентативное приложение Урока 08: ручной показ трёх элементов. */
const LESSON08_APP_HTML = `
<section>
  <h2>Ближайшая задача</h2>
  <p>Первая задача: <span id="first-task">—</span></p>
  <p>Вторая задача: <span id="second-task">—</span></p>
  <p>Первая задача выполнена: <span id="first-task-status">—</span></p>
</section>
`;

/** Репрезентативный код Урока 08 со старым ручным показом задач. */
const LESSON08_APP_JS = `
const tasks = [
  { title: 'Прочитать главу', done: false },
  { title: 'Сделать упражнение', done: false },
  { title: 'Проверить результат', done: false }
];

const exampleTask = { title: 'Составить план', done: false };

let clicks = 0;

// Канонический контракт Урока 05 (LESSON-05.md):
// порог 3 и обе строки с восклицательным знаком.
function achievementMessage(count) {
  if (count >= 3) {
    return 'Цель достигнута!';
  } else {
    return 'Продолжайте!';
  }
}

function startCounter() {
  const counter = document.querySelector('#click-count');
  const message = document.querySelector('#message');
  const firstTask = document.querySelector('#first-task');
  const secondTask = document.querySelector('#second-task');
  const firstTaskStatus = document.querySelector('#first-task-status');
  const taskCount = document.querySelector('#task-count');

  if (firstTask) {
    firstTask.textContent = tasks[0].title;
  }

  if (secondTask) {
    secondTask.textContent = tasks[1].title;
  }

  if (firstTaskStatus) {
    firstTaskStatus.textContent = tasks[0].done ? 'Выполнена' : 'Не выполнена';
  }

  if (taskCount) {
    taskCount.textContent = String(tasks.length);
  }

  const button = document.querySelector('#click-button');

  if (button) {
    button.addEventListener('click', function () {
      clicks = clicks + 1;

      if (counter) {
        counter.textContent = String(clicks);
      }

      if (message) {
        message.textContent = achievementMessage(clicks);
      }
    });
  }
}
`;

/** Каноническая функция показа Урока 09 (без обновления #task-count). */
const LESSON09_RENDER = `
function renderTaskList() {
  const list = document.querySelector('#task-list');

  if (!list) {
    console.error('Не найден список задач');
    return;
  }

  list.textContent = '';

  for (const task of tasks) {
    const item = document.createElement('li');

    if (task.done) {
      item.textContent = task.title + ' — Выполнена';
    } else {
      item.textContent = task.title + ' — Не выполнена';
    }

    list.appendChild(item);
  }
}
`;

test('P2: инструкции Урока 09 требуют удалить устаревшие обращения', () => {
  // В тексте урока чек-лист миграции должен называть все три устаревших id.
  assert.match(lesson09, /#first-task/);
  assert.match(lesson09, /#second-task/);
  assert.match(lesson09, /#first-task-status/);
  assert.match(lesson09, /#task-count/);

  // Чек-лист миграции должен присутствовать и требовать именно УДАЛЕНИЯ.
  assert.match(lesson09, /Чек-лист миграции/, 'в Уроке 09 есть явный чек-лист миграции');
  assert.match(lesson09, /ровно один раз/, 'требование одной функции показа');
});

test('P2: миграция Урока 09 убирает устаревшие селекторы из HTML и JS', () => {
  // --- Шаг 1: исходное приложение Урока 08 (как у ученика) ---------------
  const originalHtml = LESSON08_APP_HTML;
  const originalJs = LESSON08_APP_JS;

  assert.match(originalHtml, /id="first-task"/, 'до миграции элемент #first-task есть');
  assert.match(originalJs, /querySelector\('#first-task'\)/, 'до миграции обращение к #first-task есть');
  assert.match(originalJs, /querySelector\('#second-task'\)/, 'до миграции обращение к #second-task есть');
  assert.match(originalJs, /querySelector\('#first-task-status'\)/, 'до миграции обращение к #first-task-status есть');

  // --- Шаг 2: применяем инструкции Урока 09 ------------------------------
  // 2.1 Заменяем старый HTML-блок новым блоком «Задачи».
  const migratedHtml = originalHtml.replace(
    /<section>[\s\S]*?<\/section>/,
    `<section>
  <h2>Задачи</h2>
  <ul id="task-list"></ul>
  <p>Всего задач: <span id="task-count">—</span></p>
</section>`
  );

  // 2.2 Удаляем устаревшие обращения и присваивания, но сохраняем #task-count
  //     и всю несвязанную логику.
  const migratedJs = originalJs
    .replace(/^\s*const firstTask = document\.querySelector\('#first-task'\);\n/m, '')
    .replace(/^\s*const secondTask = document\.querySelector\('#second-task'\);\n/m, '')
    .replace(/^\s*const firstTaskStatus = document\.querySelector\('#first-task-status'\);\n/m, '')
    .replace(/\n\s*if \(firstTask\) \{[\s\S]*?\n\s*\}\n/g, '\n')
    .replace(/\n\s*if \(secondTask\) \{[\s\S]*?\n\s*\}\n/g, '\n')
    .replace(/\n\s*if \(firstTaskStatus\) \{[\s\S]*?\n\s*\}\n/g, '\n')
    + LESSON09_RENDER
    + '\n  renderTaskList();\n';

  // --- Шаг 3: проверяем РЕЗУЛЬТАТ ------------------------------------------
  assert.doesNotMatch(migratedHtml, /id="first-task"/, 'в HTML не осталось #first-task');
  assert.doesNotMatch(migratedHtml, /id="second-task"/, 'в HTML не осталось #second-task');
  assert.doesNotMatch(migratedHtml, /id="first-task-status"/, 'в HTML не осталось #first-task-status');
  assert.match(migratedHtml, /id="task-list"/, 'новый список на месте');
  assert.match(migratedHtml, /id="task-count"/, '#task-count сохранён');

  assert.doesNotMatch(migratedJs, /#first-task/, 'в JS не осталось обращений к #first-task');
  assert.doesNotMatch(migratedJs, /#second-task/, 'в JS не осталось обращений к #second-task');
  assert.doesNotMatch(migratedJs, /#first-task-status/, 'в JS не осталось обращений к #first-task-status');
  assert.doesNotMatch(migratedJs, /\bfirstTask\b/, 'в JS не осталось переменной firstTask');
  assert.doesNotMatch(migratedJs, /\bsecondTask\b/, 'в JS не осталось переменной secondTask');
  assert.doesNotMatch(migratedJs, /\bfirstTaskStatus\b/, 'в JS не осталось переменной firstTaskStatus');

  // Несвязанная функциональность сохранена.
  assert.match(migratedJs, /#task-count/, 'код #task-count сохранён');
  assert.match(migratedJs, /achievementMessage/, 'сообщение «Цель достигнута!» сохранено');
  assert.match(migratedJs, /exampleTask/, 'блок «Пример задачи» сохранён');
  assert.match(migratedJs, /addEventListener\('click'/, 'обработчик счётчика сохранён');

  // renderTaskList определена ровно один раз и вызвана ровно один раз.
  const definitions = migratedJs.match(/function renderTaskList\(\)/g) || [];
  const calls = migratedJs.match(/^\s*renderTaskList\(\);\s*$/gm) || [];
  assert.equal(definitions.length, 1, 'renderTaskList определена один раз');
  assert.equal(calls.length, 1, 'renderTaskList вызвана один раз');

  // --- Шаг 4: миграция реально работает ------------------------------------
  const page = makePage([
    '#task-list',
    '#task-count',
    '#click-button',
    '#click-count',
    '#message',
    '#example-status'
  ]);

  const factory = new Function(
    'document',
    'console',
    `${migratedJs}
startCounter();
return { tasks };`
  );
  const api = factory(page.document, page.consoleStub);

  assert.equal(api.tasks.length, 3, 'три задачи на месте');
  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'список построен из данных');
  assert.equal(itemText(page.registry.get('#task-list'), 0), 'Прочитать главу — Не выполнена');
  assert.equal(page.registry.get('#task-count').textContent, '3', 'количество прежнее');
  assert.equal(page.errors.length, 0, 'в консоли нет ошибок от удалённых элементов');
});

test('P2: Урок 09 остаётся верным для первоначального показа', () => {
  // Каноническая функция Урока 09 (как в уроке) строит список из данных.
  const page = makePage(['#task-list', '#task-count']);
  const factory = new Function(
    'document',
    'console',
    `const tasks = [
  { title: 'Прочитать главу', done: false },
  { title: 'Сделать упражнение', done: false },
  { title: 'Проверить результат', done: false }
];
${LESSON09_RENDER}
renderTaskList();
return { tasks };`
  );
  factory(page.document, page.consoleStub);

  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'три пункта списка');
  assert.equal(itemText(page.registry.get('#task-list'), 2), 'Проверить результат — Не выполнена');
});
