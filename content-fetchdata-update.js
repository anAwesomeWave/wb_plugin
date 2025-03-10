const OUT_ELEMS_CLASS = "wbPluginMZ";

let isActive = false;
let fetchDataObserver = null;
let fullLoadingObserver = null;
let tableElement = null;
let messageListener = null;
let tableMutationTimer = null;
const debounceDelay = 500;
const TARGET_PAGE = "https://seller.wildberries.ru/new-goods/all-goods"

// =====================
// Вспомогательные функции
// =====================

function waitForElement(selector, onElementFound) {
  const element = document.querySelector(selector);
  if (element) {
    onElementFound(element);
    return;
  }
  const observer = new MutationObserver(() => {
    const el = document.querySelector(selector);
    if (el) {
      observer.disconnect();
      onElementFound(el);
    }
  });
  observer.observe(document, { subtree: true, childList: true });
}

function triggerTableMutation(table) {
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  table.appendChild(tempDiv);
  setTimeout(() => {
    table.removeChild(tempDiv);
  }, 0);
}

function parseTotalRemainsForProduct(wbListInd) {
  return parseInt(document.querySelectorAll(
    'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
  )[wbListInd].querySelector('td[data-testid$="stocks"]').querySelector('span').innerText, 10);
}

// function updateProductElem(elemInd, daysLeft) {
//   const row = document.querySelectorAll(
//     'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
//   )[elemInd];
//   const stocksCell = row.querySelector('td[data-testid$=stocks]');
//
//   // Если элемент уже существует, удаляем его
//   const existedElems = stocksCell.querySelectorAll(`.${OUT_ELEMS_CLASS}`);
//   if (existedElems.length > 0) {
//     existedElems[0].parentNode.removeChild(existedElems[0]);
//   }
//
//   const svgNS = "http://www.w3.org/2000/svg";
//   const svg = document.createElementNS(svgNS, "svg");
//   svg.setAttribute("class", OUT_ELEMS_CLASS);
//   svg.setAttribute("width", "20");
//   svg.setAttribute("height", "20");
//
//   const circle = document.createElementNS(svgNS, "circle");
//   circle.setAttribute("cx", "10");
//   circle.setAttribute("cy", "10");
//   circle.setAttribute("r", "10");
//
//   chrome.storage.local.get(['greenborder', 'yellowborder'], (result) => {
//     if (parseInt(daysLeft, 10) < result.yellowborder) {
//       circle.setAttribute("fill", "red");
//     } else if (parseInt(daysLeft, 10) < result.greenborder) {
//       circle.setAttribute("fill", "yellow");
//     } else {
//       circle.setAttribute("fill", "green");
//     }
//   });
//
//   svg.appendChild(circle);
//   stocksCell.firstChild.appendChild(svg);
// }

function updateDaysLeftInfo(product) {
  const nmID = product["nmID"];
  const avgOrders = product["statistics"]["selectedPeriod"]["avgOrdersCountPerDay"];
  chrome.storage.local.get(['mapWbIdToIndex', 'wbIds'], (result) => {
    if (result.mapWbIdToIndex === undefined || result.wbIds === undefined) {
      console.log("ERROR FROM updateSingleProduct ", result.mapWbIdToIndex, result.wbIds);
      return;
    }
    const pageInd = result.mapWbIdToIndex[nmID];
    const totalLeft = parseTotalRemainsForProduct(pageInd);
    const daysLeft = (avgOrders === 0) ? totalLeft : totalLeft / avgOrders;
    // updateProductElem(pageInd, daysLeft);
    chrome.storage.local.set({[`wbId-${nmID}`]: daysLeft }, function() {});
  });
}

async function updateFetchDataResp(data) {
  const dataArr = data["cards"];
  console.log("Length of cards from API", dataArr.length);
  for (let i = 0; i < dataArr.length; i++) {
    updateDaysLeftInfo(dataArr[i]);
  }
}

function onTableFullReady() {
  console.log("Таблица полностью загружена и не изменяется.");
  if (tableElement && fetchDataObserver) {
    fetchDataObserver.observe(tableElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
    triggerTableMutation(tableElement);
  }
}

// =====================
// Основной функционал: init() и cleanup()
// =====================

function init() {
  if (isActive) return; // Уже включено
  isActive = true;
  console.log("Plugin init");

  // Регистрируем слушатель сообщений от background
  messageListener = function(request, sender, sendResponse) {
    if (request.action === 'fetchdata') {
      console.log(`NEW FETCH DATA WITH CODE ${request.code}`);
      if (request.code === 200) {
          updateFetchDataResp(request.data) // обновляем данные
          updateTableElements() // перекрашиваем
      }
    }
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // Создаём наблюдатель за изменениями данных (fetchDataObserver)
  fetchDataObserver = new MutationObserver((mutationsList, observer) => {
    console.log("NEW MUTATION");
    const hasExternalMutation = mutationsList.some((mutation) => {
        if (mutation.type === 'childList') {
            // Проверяем добавленные/удаленные узлы
          return [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                !node.classList?.contains(OUT_ELEMS_CLASS)
            );
        }
        return true; // Все остальные типы мутаций считаем внешними
    });
    console.log(mutationsList, hasExternalMutation);
    if (hasExternalMutation) {
    console.log("Внешнее изменение таблицы");
    this.skipNextUpdate = true; // Добавляем защитный флаг
    updateTableElements();
    }
  });

  // Наблюдатель за полной загрузкой таблицы
  fullLoadingObserver = new MutationObserver(function(mutationsList, observer) {
    console.log(mutationsList);
    if (tableMutationTimer) {
      clearTimeout(tableMutationTimer);
    }
    tableMutationTimer = setTimeout(() => {
      onTableFullReady();
      observer.disconnect();
    }, debounceDelay);
  });

  // Ждём появления таблицы и запускаем наблюдение
  waitForElement('table[data-testid="all-goods-table"] tbody', (table) => {
    console.log("Сама таблица подгружена");
    tableElement = table;
    fullLoadingObserver.observe(table, { childList: true, subtree: true, attributes: true });
  });
}

function updateTableElements() {
    document.querySelectorAll('tr[role="button"][data-testid^="all-goods-table"]').forEach((row) => {
        const nmID = parseInt(
            row.querySelector('span[data-testid="card-nmID-text"]')?.innerText?.split(": ")[1],
            10
        );
        if (!nmID) return;

        const stocksCell = row.querySelector('td[data-testid$=stocks]');
        if (!stocksCell) return;

        // Удаляем все существующие SVG
        const existingSVGs = stocksCell.querySelectorAll(`.${OUT_ELEMS_CLASS}`);
        existingSVGs.forEach(svg => svg.remove());

        // Добавляем новый элемент
        chrome.storage.local.get([`wbId-${nmID}`, 'greenborder', 'yellowborder'], (result) => {
            if (result[`wbId-${nmID}`] === undefined) return;

            const daysLeft = result[`wbId-${nmID}`];
            const color = getColorByDays(daysLeft, result.yellowborder, result.greenborder);
            const svg = createStatusSVG(color);
            stocksCell.firstChild.appendChild(svg);
        });
    });
}

function getColorByDays(daysLeft, yellowBorder, greenBorder) {
    if (daysLeft < yellowBorder) return "red";
    if (daysLeft < greenBorder) return "yellow";
    return "green";
}

function createStatusSVG(color) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", OUT_ELEMS_CLASS);
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "10");
    circle.setAttribute("fill", color);

    svg.appendChild(circle);
    return svg;
}

function cleanup() {
  if (!isActive) return; // Уже выключено
  isActive = false;
  console.log("Plugin cleanup");

  // Удаляем слушатель сообщений
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = null;
  }

  // Отключаем наблюдателей
  if (fetchDataObserver) {
    fetchDataObserver.disconnect();
    fetchDataObserver = null;
  }
  if (fullLoadingObserver) {
    fullLoadingObserver.disconnect();
    fullLoadingObserver = null;
  }

  // Очищаем таймер
  if (tableMutationTimer) {
    clearTimeout(tableMutationTimer);
    tableMutationTimer = null;
  }

  console.log("Plugin successfully disabled.");
}


function checkAndTogglePlugin() {
    if (window.location.href.includes(TARGET_PAGE)) {
        console.log("Плагин включён на этой странице");
        init();
    } else {
        console.log("Плагин выключен (страница не соответствует)");
        cleanup();
    }
}

// Запускаем проверку при загрузке страницы
checkAndTogglePlugin();

const targetPageObserver = new MutationObserver(() => {
    if (window.location.href !== targetPageObserver.lastURL) {
        targetPageObserver.lastURL = window.location.href;
        checkAndTogglePlugin();
    }
});

targetPageObserver.lastURL = window.location.href;
targetPageObserver.observe(document.body, { childList: true, subtree: true });