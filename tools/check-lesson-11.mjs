#!/usr/bin/env node
/**
 * Инструкторский smoke-тест для Урока 11.
 *
 * ЗАПУСК (из корня репозитория, стандартный Node.js, без установки пакетов):
 *
 *     node --test tools/check-lesson-11.mjs
 *
 * Тест НЕ является частью ученического пути: ученику его запускать не нужно.
 * Он проверяет центральные контракты Урока 11:
 *   - список вариантов выбора строится ИЗ ДАННЫХ (по одной опции на задачу);
 *   - порядок вариантов совпадает с порядком задач в массиве;
 *   - завершается ИМЕННО выбранная задача, а не первая;
 *   - пустой выбор (-1) ничего не меняет и не бросает исключение;
 *   - повторное завершение идемпотентно;
 *   - список и количество согласованы, повторный показ не дублирует пункты;
 *   - ровно один обработчик на кнопке завершения;
 *   - старая кнопка #complete-first-task и её обработчик отсутствуют;
 *   - счётчик, сообщение о достижении цели, тема и exampleTask не затронуты.
 *
 * Канонические фрагменты кода ИЗВЛЕКАЮТСЯ из LESSON-11.md.
 * Если фрагмент не найден или найден неоднозначно — тест ПАДАЕТ с понятным
 * сообщением, а не выбирает произвольный блок.
 *
 * ГРАНИЦЫ ДОКАЗАТЕЛЬСТВ:
 *   - JS-семантика (выбор, индекс, идемпотентность, защиты) исполняется
 *     в реальном Node.js.
 *   - DOM проверяется ЧЕРЕЗ ИМИТАЦИЮ минимального DOM (см. FakeDom ниже),
 *     а НЕ в настоящем браузере. Это НЕ нативное выполнение в браузере и
 *     НЕ визуальная проверка отображения.
 *   - Имитация моделирует `selectedIndex` согласно документированному
 *     интерфейсу HTML (позиция с нуля, -1 — ничего не выбрано), включая
 *     выбор ПЕРВОГО варианта по умолчанию, если ни один вариант не выбран.
 *     Нативная реализация `selectedIndex` в браузере НЕ измерялась.
 *   - Реальное поведение ученика в браузере НЕ измерялось.
 *
 * ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ (NC-1..NC-7, NC-SEL-1, NC-THEME-1) исполняют
 * ИСПОРЧЕННЫЕ реализации и проверяют, что соответствующая проверка
 * действительно ломается.
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

const lesson11 = readFileSync(join(ROOT, 'LESSON-11.md'), 'utf8');

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

const jsBlocks = fencedBlocks(lesson11, 'javascript');
const htmlBlocks = fencedBlocks(lesson11, 'html');

/**
 * Находит ЕДИНСТВЕННЫЙ блок кода по предикату. Ноль или больше одного —
 * понятная ошибка (тест падает, а не выбирает произвольный блок).
 */
function uniqueBlock(blocks, predicate, description) {
  const found = blocks.filter(predicate);
  if (found.length === 0) {
    throw new Error(
      'В LESSON-11.md не найден блок: ' + description +
      ' (найдено 0 подходящих блоков)'
    );
  }
  if (found.length > 1) {
    throw new Error(
      'В LESSON-11.md блок неоднозначен: ' + description +
      ' (найдено ' + found.length + ' подходящих блоков: ' +
      found.map((b) => b.context).join(' | ') + ')'
    );
  }
  return found[0].code;
}

const renderTaskChoicesSource = uniqueBlock(
  jsBlocks,
  (block) => block.code.includes('function renderTaskChoices()'),
  'каноническая функция renderTaskChoices(), строящая варианты выбора из данных'
);

const completeSelectedTaskSource = uniqueBlock(
  jsBlocks,
  (block) => block.code.includes('function completeSelectedTask()'),
  'каноническая функция completeSelectedTask()'
);

const connectButtonSource = uniqueBlock(
  jsBlocks,
  (block) =>
    block.code.includes('addEventListener') && block.code.includes('#complete-selected-task'),
  'каноническое подключение кнопки #complete-selected-task'
);

const taskListHtml = uniqueBlock(
  htmlBlocks,
  (block) => block.code.includes('id="task-list"') && block.code.includes('id="task-count"'),
  'канонический HTML-блок со списком и счётчиком'
);

// ---------------------------------------------------------------------------
// ИМИТАЦИЯ МИНИМАЛЬНОГО DOM
//
// Это НЕ браузер и НЕ визуальная проверка: здесь нет layout, нет CSS, нет
// настоящего рендеринга. Есть только то, что использует канонический код
// урока:
//   - элемент с textContent и appendChild;
//   - document.querySelector по id;
//   - document.createElement;
//   - addEventListener / диспетчеризация click.
//
// Модель selectedIndex повторяет документированный интерфейс HTML:
// значение — номер позиции выбранного варианта с нуля, -1 — ничего не
// выбрано. Нативная реализация в браузере НЕ проверялась.
//
// МОДЕЛИРУЕМАЯ СЕМАНТИКА ВЫБОРА ПО УМОЛЧАНИЮ (P1-исправление).
// Источники:
//   - MDN, HTMLSelectElement.selectedIndex:
//     «The selectedIndex property of the HTMLSelectElement interface is the
//      numeric index of the first selected <option> element in a <select>
//      element, if any, or −1 if no <option> is selected.»
//   - MDN, <select> (Usage notes):
//     «If no selected attribute is specified, the first <option> element
//      will be selected by default.»
//   - WHATWG HTML Standard, раздел «The select element», алгоритм
//     «ask for a reset»: если у <select> нет атрибута multiple, размер
//     отображения равен 1 и ни один вариант не отмечен как выбранный,
//     выбранным становится ПЕРВЫЙ вариант в порядке дерева, который не
//     отключён.
//
// ЧТО ИМЕННО МОДЕЛИРУЕТСЯ (ограниченный набор случаев Урока 11):
//   | Операция                          | selectedIndex |
//   |------------------------------------|---------------|
//   | пустой <select>                    |      -1       |
//   | добавлен первый вариант            |       0       |
//   | добавлен второй вариант            |       0       |
//   | добавлен третий вариант            |       0       |
//   | явный выбор третьего варианта      |       2       |
//   | явная установка selectedIndex = -1  |      -1       |
//   | очистка всех вариантов              |      -1       |
//   | повторное заполнение пустого списка |       0       |
//
// ЧТО НЕ МОДЕЛИРУЕТСЯ (осознанно):
//   - атрибут multiple и множественный выбор;
//   - атрибут disabled у вариантов и у <select>;
//   - placeholder-вариант (первый вариант с пустым значением);
//   - <optgroup> и вложенные <option>;
//   - выбранность, заданная атрибутом selected в разметке;
//   - полный алгоритм «ask for a reset» и синхронизация selectedIndex
//     с selectedOptions/value;
//   - поведение при вставке варианта В НАЧАЛО списка.
//
// Проверка модели против документации НЕ является выполнением в
// настоящем браузере: нативное поведение здесь НЕ измерялось.
// ---------------------------------------------------------------------------

/**
 * Имитация элемента <select> с документированным поведением selectedIndex.
 * selectedIndex всегда в пределах [-1, options.length - 1].
 */
function makeSelectElement() {
  const options = [];
  const element = {
    tagName: 'SELECT',
    id: '',
    options,
    _selectedIndex: -1,
    _text: '',
    get selectedIndex() {
      return element._selectedIndex;
    },
    set selectedIndex(value) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < -1 || n > options.length - 1) {
        return;
      }
      element._selectedIndex = n;
    },
    get textContent() {
      return element._text;
    },
    set textContent(value) {
      element._text = String(value);
      if (element._text === '') {
        options.length = 0;
        element._selectedIndex = -1;
      }
    },
    appendChild(child) {
      options.push(child);
      // Пока ни один вариант не выбран, выбранным становится первый
      // добавленный (документированное поведение выпадающего списка).
      if (element._selectedIndex === -1) {
        element._selectedIndex = 0;
      }
      return child;
    },
    addEventListener() {},
    click() {}
  };
  return element;
}

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
       * повторная регистрация той же функции для того же типа события
       * ИГНОРИРУЕТСЯ; две разные функции — это два обработчика.
       */
      addEventListener(type, handler, options) {
        const capture = Boolean(
          options && typeof options === 'object' ? options.capture : options
        );
        const already = listeners.some(
          (l) => l.type === type && l.handler === handler && l.capture === capture
        );
        if (already) {
          return;
        }
        listeners.push({ type, handler, capture });
      },
      /** Имитация нажатия: вызывает ВСЕ зарегистрированные обработчики клика. */
      click() {
        for (const listener of listeners) {
          if (listener.type === 'click') {
            listener.handler();
          }
        }
      },
      clickListenerCount() {
        return listeners.filter((l) => l.type === 'click').length;
      }
    };
    return element;
  }

  for (const id of ids) {
    const tagName = id === '#task-choice' ? 'select' : id.startsWith('#') ? 'span' : 'div';
    const element =
      tagName === 'select'
        ? makeSelectElement()
        : makeElement(tagName, id.replace('#', ''));
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
      if (String(tagName).toLowerCase() === 'option') {
        return makeElement('option', '');
      }
      return makeElement(tagName, '');
    }
  };

  return { document, registry };
}

/** Создаёт реестр элементов для типичной страницы Урока 11. */
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


// ---------------------------------------------------------------------------
// Сборка исполняемого приложения из канонических фрагментов урока
// ---------------------------------------------------------------------------

/**
 * Репрезентативный код Урока 05–09: счётчик, сообщение, тема, пример задачи,
 * список задач. Он проверяется ВМЕСТЕ с каноническим кодом Урока 11.
 *
 * Канонический контракт сообщения — из LESSON-05.md (порог 3):
 *   achievementMessage(count): count >= 3 -> 'Цель достигнута!', иначе 'Продолжайте!'
 * Порог и обе строки сообщения — из более раннего урока, а не выдуманы здесь.
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

function renderTaskList() {
  const list = document.querySelector('#task-list');

  if (!list) {
    console.error('Не найден список задач');
    return;
  }

  const count = document.querySelector('#task-count');

  if (count) {
    count.textContent = String(tasks.length);
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
}
`;

const DEFAULT_TASKS =
  "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }];";

/**
 * Собирает приложение из канонических фрагментов LESSON-11.md.
 *
 * Любой фрагмент можно подменить, чтобы получить испорченную реализацию
 * для отрицательного контроля.
 */
function buildApp(options = {}) {
  const {
    tasksLiteral = DEFAULT_TASKS,
    choicesSource = renderTaskChoicesSource,
    completeSource = completeSelectedTaskSource,
    connectSource = connectButtonSource,
    legacySource = LEGACY_SOURCE,
    extraSource = '',
    initSource = 'renderTaskChoices();\nrenderTaskList();\nstartCounter();',
    ids = [
      '#task-list',
      '#task-count',
      '#task-choice',
      '#complete-selected-task',
      '#click-button',
      '#click-count',
      '#theme-button',
      '#message',
      '#example-status'
    ]
  } = options;

  const page = makePage(ids);

  const source = `
${tasksLiteral}

${legacySource}

${choicesSource}

${completeSource}

${connectSource}

${extraSource}

${initSource}
`;

  const factory = new Function(
    'document',
    'console',
    `${source}
return {
  tasks,
  exampleTask,
  renderTaskList,
  renderTaskChoices,
  completeSelectedTask,
  achievementMessage,
  get clicks() { return clicks; },
  get points() { return points; }
};`
  );

  const api = factory(page.document, page.consoleStub);
  return { page, api, tasks: api.tasks };
}

/** Тексты всех <li> внутри #task-list. */
function listItems(list) {
  return list ? list.children : [];
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

/** Список вариантов выбора: массив объектов { text }. */
function choices(page) {
  const select = page.registry.get('#task-choice');
  return select ? select.options.map((o) => ({ text: o.textContent })) : [];
}


// ---------------------------------------------------------------------------
// МОДЕЛЬ ВЫБОРА ПО УМОЛЧАНИЮ (P1)
//
// Ниже — исполняемая проверка смоделированной семантики `selectedIndex`.
// Это НЕ выполнение в настоящем браузере: нативное поведение здесь
// НЕ измерялось. Проверяется МОДЕЛЬ на соответствие документированному
// интерфейсу HTML.
//
// Источники:
//   - MDN, HTMLSelectElement.selectedIndex («…or −1 if no <option> is
//     selected»);
//   - MDN, <select>, Usage notes («If no selected attribute is specified,
//     the first <option> element will be selected by default»);
//   - WHATWG HTML Standard, алгоритм «ask for a reset» для <select>.
// ---------------------------------------------------------------------------

/** Создаёт вариант выбора для имитации <select>. */
function makeOption(text) {
  return { tagName: 'OPTION', textContent: String(text), children: [] };
}

test('SEL-1: пустой список выбора — selectedIndex равен -1', () => {
  const select = makeSelectElement();

  assert.equal(select.selectedIndex, -1, 'у пустого списка ничего не выбрано');
  assert.equal(select.options.length, 0, 'вариантов нет');
});

test('SEL-2: добавление ПЕРВОГО варианта выбирает его (selectedIndex = 0)', () => {
  const select = makeSelectElement();

  select.appendChild(makeOption('Прочитать главу'));

  assert.equal(select.selectedIndex, 0, 'первый вариант выбран по умолчанию');
});

test('SEL-3: добавление ВТОРОГО и ТРЕТЬЕГО вариантов не меняет выбор', () => {
  const select = makeSelectElement();

  select.appendChild(makeOption('Прочитать главу'));
  assert.equal(select.selectedIndex, 0, 'после первого варианта выбран первый');

  select.appendChild(makeOption('Сделать упражнение'));
  assert.equal(select.selectedIndex, 0, 'после второго варианта выбран первый');

  select.appendChild(makeOption('Проверить результат'));
  assert.equal(select.selectedIndex, 0, 'после третьего варианта выбран первый');

  assert.equal(select.options.length, 3, 'вариантов три');
});

test('SEL-4: явный выбор третьего варианта даёт selectedIndex = 2', () => {
  const select = makeSelectElement();

  select.appendChild(makeOption('Прочитать главу'));
  select.appendChild(makeOption('Сделать упражнение'));
  select.appendChild(makeOption('Проверить результат'));

  select.selectedIndex = 2;

  assert.equal(select.selectedIndex, 2, 'выбран третий вариант');
});

test('SEL-5: явная установка selectedIndex = -1 снимает выбор', () => {
  const select = makeSelectElement();

  select.appendChild(makeOption('Прочитать главу'));
  select.appendChild(makeOption('Сделать упражнение'));

  select.selectedIndex = -1;

  assert.equal(select.selectedIndex, -1, 'выбор снят');
  assert.equal(select.options.length, 2, 'варианты при этом остались на месте');
});

test('SEL-6: очистка всех вариантов снова даёт selectedIndex = -1', () => {
  const select = makeSelectElement();

  select.appendChild(makeOption('Прочитать главу'));
  select.appendChild(makeOption('Сделать упражнение'));
  assert.equal(select.selectedIndex, 0, 'до очистки выбран первый');

  select.textContent = '';

  assert.equal(select.selectedIndex, -1, 'после очистки ничего не выбрано');
  assert.equal(select.options.length, 0, 'вариантов не осталось');
});

test('SEL-7: повторное заполнение пустого списка снова выбирает первый вариант', () => {
  const select = makeSelectElement();

  select.appendChild(makeOption('Прочитать главу'));
  select.textContent = '';
  assert.equal(select.selectedIndex, -1, 'после очистки ничего не выбрано');

  select.appendChild(makeOption('Прочитать главу'));
  select.appendChild(makeOption('Сделать упражнение'));

  assert.equal(select.selectedIndex, 0, 'после повторного заполнения выбран первый');
});

test('SEL-8: выбор по умолчанию работает и в репрезентативном приложении', () => {
  const { page } = buildApp();

  const select = page.registry.get('#task-choice');

  assert.equal(select.options.length, 3, 'вариантов три');
  assert.equal(select.selectedIndex, 0, 'первая задача выбрана по умолчанию');
});

test('NC-SEL-1: ПРЕЖНЯЯ модель (выбор не по умолчанию) ломает проверку SEL-2', () => {
  // Испорченная реализация: appendChild() НЕ выбирает первый вариант —
  // ровно то поведение, которое было в имитации до исправления.
  const brokenAppendChild = function (child) {
    this.options.push(child);
    return child;
  };

  const select = makeSelectElement();
  select.appendChild = brokenAppendChild;

  select.appendChild(makeOption('Прочитать главу'));

  // Прежняя модель утверждает -1 — и это НЕВЕРНО по документации.
  assert.equal(select.selectedIndex, -1, 'прежняя модель даёт -1 после первого варианта');

  // Контракт «после добавления первого варианта выбран первый» обязан сломаться.
  assert.notEqual(
    select.selectedIndex,
    0,
    'контракт «первый вариант выбран по умолчанию» должен сломаться на прежней модели'
  );

  // Исправленная модель даёт 0 для того же сценария.
  const fixed = makeSelectElement();
  fixed.appendChild(makeOption('Прочитать главу'));
  assert.equal(fixed.selectedIndex, 0, 'исправленная модель даёт 0');
});


// ---------------------------------------------------------------------------
// Статические проверки текста урока
// ---------------------------------------------------------------------------

test('урок содержит канонические фрагменты', () => {
  assert.match(renderTaskChoicesSource, /function renderTaskChoices\(\)/);
  assert.match(renderTaskChoicesSource, /#task-choice/);
  assert.match(renderTaskChoicesSource, /for \(const task of tasks\)/);
  assert.match(renderTaskChoicesSource, /createElement\('option'\)/);
  assert.match(renderTaskChoicesSource, /option\.textContent = task\.title;/);
  assert.match(renderTaskChoicesSource, /select\.appendChild\(option\);/);

  assert.match(completeSelectedTaskSource, /function completeSelectedTask\(\)/);
  assert.match(completeSelectedTaskSource, /select\.selectedIndex/);
  assert.match(completeSelectedTaskSource, /index < 0 \|\| index >= tasks\.length/);
  assert.match(completeSelectedTaskSource, /tasks\[index\]\.done = true;/);
  assert.match(completeSelectedTaskSource, /renderTaskList\(\);/);

  assert.match(connectButtonSource, /#complete-selected-task/);
  assert.match(connectButtonSource, /addEventListener\('click', completeSelectedTask\)/);
});

test('в уроке нет старой кнопки завершения первой задачи', () => {
  assert.doesNotMatch(
    taskListHtml,
    /id="complete-first-task"/,
    'старая кнопка #complete-first-task не должна оставаться в канонической разметке'
  );
  assert.doesNotMatch(
    lesson11,
    /id="complete-first-task"/,
    'урок не должен предлагать старую кнопку как рабочую'
  );
});

test('урок не вводит запрещённые понятия', () => {
  const forbidden = [
    'dataset',
    'closest(',
    'innerHTML',
    'Promise',
    'async ',
    'await ',
    'class ',
    'localStorage',
    'sessionStorage',
    'Number('
  ];
  for (const token of forbidden) {
    const codeOnly = jsBlocks.map((b) => b.code).join('\n');
    assert.ok(
      !codeOnly.includes(token),
      'в каноническом коде Урока 11 не должно быть: ' + token
    );
  }
});

test('урок не вводит делегирование событий и замыкания как новые понятия', () => {
  // Проверяем КОД, а не весь текст: в разделе «Что НЕ понадобится»
  // эти термины названы как запрещённые — это не «введение понятия».
  const codeOnly = jsBlocks.map((b) => b.code).join('\n');
  assert.doesNotMatch(codeOnly, /delegat/i, 'в коде нет делегирования событий');
  assert.doesNotMatch(codeOnly, /closest|dataset/, 'в коде нет closest/dataset');

  // В тексте урока термин может встречаться только в списке запрещённого.
  const forbiddenMentions = lesson11
    .split('\n')
    .filter((line) => /делегирован/i.test(line) || /замыкани/i.test(line));
  for (const line of forbiddenMentions) {
    assert.ok(
      /не понадобится|не вводим|не нужно|не требуется|запрещ/i.test(line) ||
        line.includes('делегирования событий, ни кнопки'),
      'термин встречается только в запрещённом списке, а не как новое понятие: ' + line
    );
  }
});

test('в уроке порядок PRIMM: Predict → Run → Investigate → Modify → Make', () => {
  const predict = lesson11.indexOf('## Шаг 1. Predict');
  const run = lesson11.indexOf('## Шаг 2. Run');
  const investigate = lesson11.indexOf('## Шаг 3. Investigate');
  const modify = lesson11.indexOf('## Шаг 4. Modify');
  const make = lesson11.indexOf('## Шаг 5. Make');

  for (const [name, pos] of [
    ['Predict', predict],
    ['Run', run],
    ['Investigate', investigate],
    ['Modify', modify],
    ['Make', make]
  ]) {
    assert.ok(pos >= 0, 'в LESSON-11.md есть раздел «' + name + '»');
  }

  assert.ok(predict < run, 'Predict идёт перед Run');
  assert.ok(run < investigate, 'Run идёт перед Investigate');
  assert.ok(investigate < modify, 'Investigate идёт перед Modify');
  assert.ok(modify < make, 'Modify идёт перед Make');
});

test('в шаге Predict нет исполняемого кода — предсказания идут ДО запуска', () => {
  const predictStart = lesson11.indexOf('## Шаг 1. Predict');
  const runStart = lesson11.indexOf('## Шаг 2. Run');
  const predictSection = lesson11.slice(predictStart, runStart);

  const predictJs = fencedBlocks(predictSection, 'javascript');
  assert.equal(
    predictJs.length,
    0,
    'в шаге Predict не должно быть ни одного исполняемого блока javascript'
  );
  assert.match(predictSection, /Запишите предсказания/i, 'требование записать предсказания есть');
});

test('Make остаётся необязательным', () => {
  assert.match(lesson11, /Шаг 5\. Make[\s\S]*?необязательн/i, 'шаг Make помечен необязательным');
});


// ---------------------------------------------------------------------------
// ПОЗИТИВНЫЕ ПРОВЕРКИ
// ---------------------------------------------------------------------------

test('P1: три задачи создают три варианта выбора', () => {
  const { page } = buildApp();

  assert.equal(choices(page).length, 3, 'три варианта выбора');
});

test('P2: четыре задачи создают четыре варианта выбора', () => {
  const { page } = buildApp({
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }, { title: 'Написать отчёт', done: false }];"
  });

  assert.equal(choices(page).length, 4, 'четыре варианта выбора');
});

test('P3: пустой массив создаёт ноль вариантов выбора', () => {
  const { page } = buildApp({ tasksLiteral: 'const tasks = [];' });

  assert.equal(choices(page).length, 0, 'ни одного варианта выбора');
  assert.equal(shownCount(page), '0', 'количество задач — 0');
});

test('P4: варианты сохраняют порядок задач', () => {
  const { page } = buildApp();

  assert.deepEqual(
    choices(page).map((o) => o.text),
    ['Прочитать главу', 'Сделать упражнение', 'Проверить результат'],
    'порядок вариантов совпадает с порядком задач'
  );

  const listTitles = listItems(page.registry.get('#task-list')).map((li) =>
    li.textContent.split(' — ')[0]
  );
  assert.deepEqual(
    choices(page).map((o) => o.text),
    listTitles,
    'порядок вариантов совпадает с порядком пунктов списка'
  );
});

test('P5: выбор индекса 0 завершает ТОЛЬКО первую задачу', () => {
  const { page, tasks } = buildApp();

  page.registry.get('#task-choice').selectedIndex = 0;
  page.registry.get('#complete-selected-task').click();

  assert.equal(tasks[0].done, true, 'первая задача завершена');
  assert.equal(tasks[1].done, false, 'вторая не тронута');
  assert.equal(tasks[2].done, false, 'третья не тронута');
  assert.equal(
    itemText(page.registry.get('#task-list'), 0),
    'Прочитать главу — Выполнена',
    'на экране у первой «Выполнена»'
  );
});

test('P6: выбор индекса 1 завершает ТОЛЬКО вторую задачу', () => {
  const { page, tasks } = buildApp();

  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  assert.equal(tasks[0].done, false, 'первая не тронута');
  assert.equal(tasks[1].done, true, 'вторая задача завершена');
  assert.equal(tasks[2].done, false, 'третья не тронута');
  assert.equal(
    itemText(page.registry.get('#task-list'), 1),
    'Сделать упражнение — Выполнена',
    'на экране у второй «Выполнена»'
  );
});

test('P7: выбор индекса 2 завершает ТОЛЬКО третью задачу', () => {
  const { page, tasks } = buildApp();

  page.registry.get('#task-choice').selectedIndex = 2;
  page.registry.get('#complete-selected-task').click();

  assert.equal(tasks[0].done, false, 'первая не тронута');
  assert.equal(tasks[1].done, false, 'вторая не тронута');
  assert.equal(tasks[2].done, true, 'третья задача завершена');
  assert.equal(
    itemText(page.registry.get('#task-list'), 2),
    'Проверить результат — Выполнена',
    'на экране у третьей «Выполнена»'
  );
});


test('P8: отсутствие выбора (-1) ничего не меняет и ничего не бросает', () => {
  const { page, tasks } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = -1;
  assert.equal(select.selectedIndex, -1, 'выбор сброшен');

  assert.doesNotThrow(
    () => page.registry.get('#complete-selected-task').click(),
    'нажатие при пустом выборе не бросает исключение'
  );

  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, false, false],
    'ни одна задача не изменилась'
  );
  assert.deepEqual(page.errors, ['Задача не выбрана'], 'в консоли понятное сообщение');
  assert.equal(
    itemText(page.registry.get('#task-list'), 0),
    'Прочитать главу — Не выполнена',
    'на экране всё по-прежнему'
  );
});

test('P9: повторное завершение выбранной задачи идемпотентно', () => {
  const { page, tasks } = buildApp();

  const select = page.registry.get('#task-choice');
  const button = page.registry.get('#complete-selected-task');

  select.selectedIndex = 1;
  button.click();
  button.click();
  button.click();

  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, true, false],
    'только вторая задача завершена, ровно один раз'
  );
  assert.equal(
    itemText(page.registry.get('#task-list'), 1),
    'Сделать упражнение — Выполнена',
    'на экране «Выполнена»'
  );
});

test('P10: показанное количество задач остаётся верным', () => {
  const { page, tasks } = buildApp();

  assert.equal(shownCount(page), '3', 'изначально показано 3');

  page.registry.get('#task-choice').selectedIndex = 2;
  page.registry.get('#complete-selected-task').click();

  assert.equal(shownCount(page), '3', 'после завершения задачи количество не изменилось');
  assert.equal(tasks.length, 3, 'в массиве по-прежнему три задачи');
  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'три пункта списка');
});

test('P11: повторный показ списка не дублирует пункты', () => {
  const { page, api } = buildApp();

  api.renderTaskList();
  api.renderTaskList();
  api.renderTaskList();

  assert.equal(listItems(page.registry.get('#task-list')).length, 3, 'ровно три пункта');
});

test('P12: повторный показ выборов не дублирует варианты', () => {
  const { page, api } = buildApp();

  api.renderTaskChoices();
  api.renderTaskChoices();

  assert.equal(choices(page).length, 3, 'ровно три варианта выбора');
});

test('P13: перезагрузка из неизменённого источника восстанавливает начальное состояние', () => {
  const first = buildApp();
  first.page.registry.get('#task-choice').selectedIndex = 1;
  first.page.registry.get('#complete-selected-task').click();
  assert.equal(first.tasks[1].done, true, 'задача завершена до перезагрузки');

  // «Перезагрузка» — новый запуск того же исходного кода.
  const second = buildApp();

  assert.deepEqual(
    second.tasks.map((t) => t.done),
    [false, false, false],
    'начальные состояния восстановлены'
  );
  assert.equal(
    itemText(second.page.registry.get('#task-list'), 1),
    'Сделать упражнение — Не выполнена',
    'на экране снова «Не выполнена»'
  );
});


test('P14: счётчик, сообщение, тема и exampleTask не затронуты', () => {
  const { page, api, tasks } = buildApp();

  const counter = page.registry.get('#click-button');
  counter.click();
  counter.click();
  counter.click();

  assert.equal(page.registry.get('#click-count').textContent, '3', 'счётчик работает');
  assert.equal(
    page.registry.get('#message').textContent,
    'Цель достигнута!',
    'сообщение о достижении цели прежнее'
  );

  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  assert.equal(tasks[1].done, true, 'выбранная задача завершена');
  assert.equal(page.registry.get('#click-count').textContent, '3', 'счётчик кликов не изменился');
  assert.equal(
    page.registry.get('#message').textContent,
    'Цель достигнута!',
    'сообщение не изменилось'
  );
  assert.equal(api.achievementMessage(3), 'Цель достигнута!', 'порог сообщения прежний');
  assert.equal(api.exampleTask.done, false, 'exampleTask не изменился');
  assert.equal(
    page.registry.get('#example-status').textContent,
    'Не выполнена',
    'блок «Пример задачи» прежний'
  );

  page.registry.get('#theme-button').click();
  assert.equal(
    page.registry.get('#theme-button').clickListenerCount(),
    1,
    'на кнопке темы один обработчик'
  );
});

test('P15: названия задач вставляются как ТЕКСТ, а не как HTML', () => {
  const { page } = buildApp({
    tasksLiteral:
      "const tasks = [{ title: '<b>Жирный</b> & <script>', done: false }, { title: 'Обычная', done: false }];"
  });

  const select = page.registry.get('#task-choice');
  const option = select.options[0];

  assert.equal(option.textContent, '<b>Жирный</b> & <script>', 'текст варианта — как есть');
  assert.equal(option.children.length, 0, 'внутри варианта нет дочерних элементов');
  assert.equal(option.innerHTML, undefined, 'innerHTML не используется');
});

test('P16: на кнопке завершения ровно один обработчик', () => {
  const { page } = buildApp();

  const button = page.registry.get('#complete-selected-task');
  assert.equal(button.clickListenerCount(), 1, 'один обработчик клика');
});

test('P17: старой кнопки и старого обработчика в каноническом приложении нет', () => {
  const { page } = buildApp({
    ids: [
      '#task-list',
      '#task-count',
      '#task-choice',
      '#complete-selected-task',
      '#complete-first-task',
      '#click-button'
    ]
  });

  // Старая кнопка может присутствовать в DOM, но к ней НЕ должно быть
  // подключено ни одного обработчика из канонического кода Урока 11.
  const oldButton = page.registry.get('#complete-first-task');
  assert.equal(oldButton.clickListenerCount(), 0, 'на старой кнопке нет обработчиков');

  const codeOnly = jsBlocks.map((b) => b.code).join('\n');
  assert.doesNotMatch(codeOnly, /completeFirstTask/, 'старой функции в коде урока нет');
  assert.doesNotMatch(codeOnly, /#complete-first-task/, 'старой кнопки в коде урока нет');
});

test('P18: выбор не меняет данные до нажатия кнопки', () => {
  const { page, tasks } = buildApp();

  const select = page.registry.get('#task-choice');
  select.selectedIndex = 2;
  select.selectedIndex = 0;

  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, false, false],
    'переключение выбора само по себе не меняет задачи'
  );
});

test('P19: кнопка темы ПЕРЕКЛЮЧАЕТ класс dark на body (поведенческая проверка)', () => {
  // ГРАНИЦА ДОКАЗАТЕЛЬСТВ: проверяется СОСТОЯНИЕ КЛАССА в имитации DOM
  // (`document.body.classList.contains('dark')`). Это НЕ визуальная проверка
  // и НЕ выполнение в настоящем браузере: ни CSS, ни layout здесь не
  // вычисляются. Проверяется факт переключения класса, а не картинка.
  const { page, tasks } = buildApp();

  const themeButton = page.registry.get('#theme-button');
  const body = page.document.body;

  const isDark = () => body.classList.contains('dark');

  // 1. Изначально тёмной темы нет.
  assert.equal(isDark(), false, 'изначально класс dark не установлен');

  // 2. Первое нажатие включает тёмную тему.
  themeButton.click();
  assert.equal(isDark(), true, 'после первого нажатия тема тёмная');

  // 3. Второе нажатие выключает её обратно.
  themeButton.click();
  assert.equal(isDark(), false, 'после второго нажатия тема снова светлая');

  // 4. Завершение задачи НЕ меняет состояние темы.
  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  assert.equal(tasks[1].done, true, 'выбранная задача завершена');
  assert.equal(isDark(), false, 'завершение задачи не изменило тему');

  // 5. Третье нажатие снова включает тёмную тему.
  themeButton.click();
  assert.equal(isDark(), true, 'после третьего нажатия тема снова тёмная');
});

test('P19b: на кнопке темы ровно один обработчик (отдельная проверка)', () => {
  // Проверка числа подписок остаётся ОТДЕЛЬНОЙ от поведенческой:
  // обработчик может быть зарегистрирован и не переключать тему.
  const { page } = buildApp();

  assert.equal(
    page.registry.get('#theme-button').clickListenerCount(),
    1,
    'на кнопке темы один обработчик'
  );
});

test('P20: необязательное упражнение points не меняется от завершения задачи', () => {
  // `points` — необязательное упражнение Урока 03 (+2 за нажатие
  // счётчика). Раньше набор Урока 11 содержал переменную `points`,
  // но НЕ проверял её значение. Здесь состояние `points` наблюдается
  // явно: завершение задачи не должно его трогать.
  const { page, api, tasks } = buildApp();

  const counter = page.registry.get('#click-button');
  counter.click();
  counter.click();

  // Каноническое упражнение Урока 03: `points = points + 2` за нажатие,
  // поэтому два нажатия дают clicks = 2 и points = 4.
  assert.equal(api.clicks, 2, 'после двух нажатий clicks = 2');
  assert.equal(api.points, 4, 'после двух нажатий points = 4');

  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  assert.equal(tasks[1].done, true, 'выбранная задача завершена');
  assert.equal(api.points, 4, 'points не изменился от завершения задачи');
  assert.equal(api.clicks, 2, 'clicks не изменился от завершения задачи');
  assert.equal(page.registry.get('#click-count').textContent, '2', 'счётчик на экране прежний');
});


// ---------------------------------------------------------------------------
// ОТРИЦАТЕЛЬНЫЕ КОНТРОЛИ
//
// Каждый контроль ИСПОЛНЯЕТ испорченную реализацию и проверяет, что
// соответствующая проверка действительно ломается. Ни один контроль не
// ограничивается просмотром строк исходного текста.
// ---------------------------------------------------------------------------

test('NC-1: реализация, всегда завершающая tasks[0], ломает выбор второй задачи', () => {
  // Испорченная реализация: индекс выбранного варианта игнорируется.
  const broken = completeSelectedTaskSource.replace(
    /tasks\[index\]\.done = true;/,
    'tasks[0].done = true;'
  );

  assert.notEqual(broken, completeSelectedTaskSource, 'индекс действительно подменён на 0');

  const { page, tasks } = buildApp({ completeSource: broken });

  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  // Проверка «завершена ВЫБРАННАЯ задача» обязана сломаться.
  assert.equal(tasks[1].done, false, 'вторая (выбранная) задача НЕ завершена');
  assert.equal(tasks[0].done, true, 'завершена не та задача — первая');
  assert.notEqual(
    itemText(page.registry.get('#task-list'), 1),
    'Сделать упражнение — Выполнена',
    'на экране у выбранной задачи должно остаться «Не выполнена»'
  );
});

test('NC-2: неверное соответствие «вариант ↔ задача» ломает выбор третьей задачи', () => {
  // Испорченная реализация: выбранный вариант отображается на задачу со
  // сдвигом — вариант 2 (третий) завершает tasks[1] (вторую).
  const broken = completeSelectedTaskSource.replace(
    /tasks\[index\]\.done = true;/,
    'tasks[index - 1].done = true;'
  );

  assert.notEqual(broken, completeSelectedTaskSource, 'соответствие вариантов и задач сломано');

  const { page, tasks } = buildApp({ completeSource: broken });

  page.registry.get('#task-choice').selectedIndex = 2;
  page.registry.get('#complete-selected-task').click();

  // Третья задача НЕ должна быть завершена — завершена вторая.
  assert.equal(tasks[2].done, false, 'третья (выбранная) задача НЕ завершена');
  assert.equal(tasks[1].done, true, 'завершена не та задача — вторая');
});

test('NC-3: изменение данных без повторного показа оставляет устаревший текст', () => {
  // Испорченная реализация: данные меняются, но renderTaskList() не вызывается.
  const broken = completeSelectedTaskSource.replace(/\n\s*renderTaskList\(\);/, '');

  assert.notEqual(broken, completeSelectedTaskSource, 'вызов renderTaskList() действительно удалён');

  const { page, tasks } = buildApp({ completeSource: broken });

  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  // Данные изменились…
  assert.equal(tasks[1].done, true, 'данные изменились');
  // …а на экране остался старый текст: проверка состояния на экране ЛОМАЕТСЯ.
  const shown = itemText(page.registry.get('#task-list'), 1);
  assert.notEqual(shown, 'Сделать упражнение — Выполнена', 'на экране должно остаться «Не выполнена»');
  assert.equal(shown, 'Сделать упражнение — Не выполнена', 'текст на экране устарел');
});

test('NC-4: два РАЗНЫХ обработчика на кнопке ломают контракт числа подписок', () => {
  // Настоящий дубликат: две разные функции-обёртки (не одна и та же).
  const duplicated = connectButtonSource.replace(
    /completeButton\.addEventListener\('click', completeSelectedTask\);/,
    [
      "completeButton.addEventListener('click', function () {",
      '  completeSelectedTask();',
      '});',
      '',
      "completeButton.addEventListener('click', function () {",
      '  completeSelectedTask();',
      '});'
    ].join('\n')
  );

  assert.notEqual(duplicated, connectButtonSource, 'обработчик действительно продублирован');

  const { page } = buildApp({ connectSource: duplicated });
  const button = page.registry.get('#complete-selected-task');

  assert.equal(button.clickListenerCount(), 2, 'на кнопке два обработчика');

  // Итоговое состояние НЕ отличает дублирование — ломается именно контракт.
  assert.notEqual(button.clickListenerCount(), 1, 'контракт «один обработчик» должен сломаться');
});


test('NC-4b: ОДИНАКОВАЯ функция, зарегистрированная дважды, дубликатом НЕ является', () => {
  // Контроль на ложное срабатывание: native EventTarget игнорирует повторную
  // регистрацию той же функции, поэтому число обработчиков остаётся равным 1.
  const duplicated = connectButtonSource.replace(
    /completeButton\.addEventListener\('click', completeSelectedTask\);/,
    "completeButton.addEventListener('click', completeSelectedTask);\n    completeButton.addEventListener('click', completeSelectedTask);"
  );

  assert.notEqual(duplicated, connectButtonSource, 'повторная регистрация действительно добавлена');

  const { page } = buildApp({ connectSource: duplicated });
  const button = page.registry.get('#complete-selected-task');

  assert.equal(button.clickListenerCount(), 1, 'одинаковая функция считается одним обработчиком');
});

test('NC-5: доступ к tasks[-1] без проверки ломает контракт безопасного пустого выбора', () => {
  // Испорченная реализация: защита от пустого выбора удалена.
  const broken = completeSelectedTaskSource.replace(
    /if \(index < 0 \|\| index >= tasks\.length\) \{[\s\S]*?\n  \}\n/,
    ''
  );

  assert.notEqual(broken, completeSelectedTaskSource, 'защита пустого выбора действительно удалена');

  const { page, tasks } = buildApp({ completeSource: broken });

  page.registry.get('#task-choice').selectedIndex = -1;

  let thrown = null;
  try {
    page.registry.get('#complete-selected-task').click();
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown !== null, 'испорченная реализация обязана бросать исключение');
  assert.match(String(thrown && thrown.message), /undefined|Cannot read/i, 'ожидаемая ошибка доступа к undefined');
  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, false, false],
    'задачи не изменились'
  );
});

test('NC-5b: каноническая реализация на пустом выборе исключения не бросает', () => {
  const { page, tasks } = buildApp();

  page.registry.get('#task-choice').selectedIndex = -1;

  assert.doesNotThrow(() => page.registry.get('#complete-selected-task').click());
  assert.deepEqual(page.errors, ['Задача не выбрана']);
  assert.deepEqual(
    tasks.map((t) => t.done),
    [false, false, false],
    'задачи не изменились'
  );
});

test('NC-6: захардкоженные три варианта ломают контраст «варианты из данных»', () => {
  // Испорченная реализация: три фиксированных варианта вместо цикла по данным.
  const broken = [
    'function renderTaskChoices() {',
    "  const select = document.querySelector('#task-choice');",
    '',
    '  if (!select) {',
    "    console.error('Не найден выбор задачи');",
    '    return;',
    '  }',
    '',
    "  select.textContent = '';",
    '',
    "  const titles = ['Прочитать главу', 'Сделать упражнение', 'Проверить результат'];",
    '',
    '  for (const title of titles) {',
    "    const option = document.createElement('option');",
    '    option.textContent = title;',
    '    select.appendChild(option);',
    '  }',
    '}'
  ].join('\n');

  assert.notEqual(broken, renderTaskChoicesSource, 'варианты действительно захардкожены');

  const { page } = buildApp({
    choicesSource: broken,
    tasksLiteral:
      "const tasks = [{ title: 'Прочитать главу', done: false }, { title: 'Сделать упражнение', done: false }, { title: 'Проверить результат', done: false }, { title: 'Написать отчёт', done: false }];"
  });

  // Четыре задачи — а вариантов только три: четвёртой задачи в списке нет.
  assert.equal(choices(page).length, 3, 'вариантов всего три');
  assert.notEqual(
    choices(page).length,
    4,
    'контракт «одна опция на задачу» должен сломаться'
  );
  assert.equal(
    choices(page).some((o) => o.text === 'Написать отчёт'),
    false,
    'четвёртая задача не представлена в списке выбора'
  );
});

test('NC-7: оставшийся старый обработчик меняет ПЕРВУЮ задачу вместо выбранной', () => {
  // Испорченная реализация: старый обработчик первой задачи остался
  // подключён К ТОЙ ЖЕ кнопке завершения рядом с новым обработчиком
  // выбранной задачи. Нажатие завершает ОБЕ задачи — первую «по старой
  // привычке» и выбранную по-настоящему.
  const stale = [
    "const staleCompleteButton = document.querySelector('#complete-selected-task');",
    '',
    'if (staleCompleteButton) {',
    "  staleCompleteButton.addEventListener('click', function () {",
    '    tasks[0].done = true;',
    '    renderTaskList();',
    '  });',
    '}'
  ].join('\n');

  const { page, tasks } = buildApp({
    extraSource: stale,
    ids: [
      '#task-list',
      '#task-count',
      '#task-choice',
      '#complete-selected-task',
      '#click-button'
    ]
  });

  // Выбираем ВТОРУЮ задачу и нажимаем кнопку завершения.
  page.registry.get('#task-choice').selectedIndex = 1;
  page.registry.get('#complete-selected-task').click();

  // Старый обработчик изменил ПЕРВУЮ задачу — этого не должно происходить.
  assert.equal(tasks[0].done, true, 'старый обработчик изменил первую задачу');
  assert.equal(tasks[1].done, true, 'выбранная вторая задача тоже завершена');

  // А вот каноническое приложение такой ситуации не даёт:
  const clean = buildApp();
  clean.page.registry.get('#task-choice').selectedIndex = 1;
  clean.page.registry.get('#complete-selected-task').click();
  assert.equal(clean.tasks[0].done, false, 'в каноническом приложении первая не тронута');
  assert.equal(clean.tasks[1].done, true, 'в каноническом приложении завершена выбранная');

  // И контракт «один обработчик» на кнопке ломается:
  assert.notEqual(
    page.registry.get('#complete-selected-task').clickListenerCount(),
    1,
    'контракт «один обработчик» должен сломаться'
  );
});

test('NC-THEME-1: обработчик темы, НЕ переключающий класс, ломает поведенческую проверку', () => {
  // Испорченная реализация: обработчик темы зарегистрирован, но класс
  // `dark` НЕ переключает. Именно этот дефект НЕ ловила прежняя
  // проверка «число обработчиков на кнопке равно 1».
  const brokenLegacy = LEGACY_SOURCE.replace(
    "document.body.classList.toggle('dark');",
    "console.error('Тема не переключается');"
  );

  assert.notEqual(brokenLegacy, LEGACY_SOURCE, 'переключение темы действительно сломано');

  const { page } = buildApp({ legacySource: brokenLegacy });

  const themeButton = page.registry.get('#theme-button');
  const body = page.document.body;

  // Прежняя проверка «число подписок» ПРОХОДИТ — дефект в ней не виден:
  assert.equal(themeButton.clickListenerCount(), 1, 'обработчик по-прежнему зарегистрирован');

  themeButton.click();

  // А поведенческая проверка ОБЯЗАНА сломаться: тема не переключилась.
  assert.equal(
    body.classList.contains('dark'),
    false,
    'испорченная реализация не переключает тему'
  );
  assert.notEqual(
    body.classList.contains('dark'),
    true,
    'контракт «после первого нажатия тема тёмная» должен сломаться'
  );

  // Канонический обработчик ту же последовательность проходит.
  const clean = buildApp();
  clean.page.registry.get('#theme-button').click();
  assert.equal(
    clean.page.document.body.classList.contains('dark'),
    true,
    'каноническая реализация переключает тему'
  );
});
