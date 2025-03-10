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
  table.setAttribute('data-mutation', 'triggered');
  setTimeout(() => {
    table.removeAttribute('data-mutation');
  }, 0);
}

function parseTotalRemainsForProduct(wbListInd) {
  return parseInt(document.querySelectorAll(
    'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
  )[wbListInd].querySelector('td[data-testid$="stocks"]').querySelector('span').innerText, 10);
}

function updateProductElem(elemInd, daysLeft) {
  const row = document.querySelectorAll(
    'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
  )[elemInd];
  const stocksCell = row.querySelector('td[data-testid$=stocks]');

  // Если элемент уже существует, удаляем его
  const existedElems = stocksCell.querySelectorAll(`.${OUT_ELEMS_CLASS}`);
  if (existedElems.length > 0) {
    existedElems[0].parentNode.removeChild(existedElems[0]);
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", OUT_ELEMS_CLASS);
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");

  const circle = document.createElementNS(svgNS, "circle");
  circle.setAttribute("cx", "10");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "10");

  chrome.storage.local.get(['greenborder', 'yellowborder'], (result) => {
    if (parseInt(daysLeft, 10) < result.yellowborder) {
      circle.setAttribute("fill", "red");
    } else if (parseInt(daysLeft, 10) < result.greenborder) {
      circle.setAttribute("fill", "yellow");
    } else {
      circle.setAttribute("fill", "green");
    }
  });

  svg.appendChild(circle);
  stocksCell.firstChild.appendChild(svg);
}

function updateSingleProduct(product) {
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
    updateProductElem(pageInd, daysLeft);
    chrome.storage.local.set({[`wbId-${nmID}`]: daysLeft }, function() {});
  });
}

async function updateFetchDataResp(data) {
  const dataArr = data["cards"];
  console.log("Length of cards from API", dataArr.length);
  for (let i = 0; i < dataArr.length; i++) {
    updateSingleProduct(dataArr[i]);
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
        updateFetchDataResp(request.data);
      }
    }
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // Создаём наблюдатель за изменениями данных (fetchDataObserver)
  fetchDataObserver = new MutationObserver((mutationsList, observer) => {
    console.log("NEW MUTATION");
    const allInternal = mutationsList.every(mutation => {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains(OUT_ELEMS_CLASS)) {
            return false;
          }
        }
        for (let node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains(OUT_ELEMS_CLASS)) {
            return false;
          }
        }
        return true;
      } else if (mutation.type === 'attributes') {
        return mutation.target.classList.contains(OUT_ELEMS_CLASS);
      }
      return false;
    });
    console.log(mutationsList, allInternal);
    document.querySelectorAll(
      'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr'
    ).forEach((row) => {
      if (!allInternal && !row.querySelector(`.${OUT_ELEMS_CLASS}`)) {
        console.log("WEEWEE", row, row.querySelector(`.${OUT_ELEMS_CLASS}`));
        const nmID = parseInt(
          row.querySelector('span[data-testid="card-nmID-text"]').innerText.split(": ")[1],
          10
        );
        const nmIDVar = `wbId-${nmID}`;
        chrome.storage.local.get([nmIDVar, 'greenborder', 'yellowborder'], (result) => {
          if (result[nmIDVar] === undefined) {
            return;
          }
          const svgNS = "http://www.w3.org/2000/svg";
          const svg = document.createElementNS(svgNS, "svg");
          svg.setAttribute("class", OUT_ELEMS_CLASS);
          svg.setAttribute("width", "20");
          svg.setAttribute("height", "20");
          const circle = document.createElementNS(svgNS, "circle");
          circle.setAttribute("cx", "10");
          circle.setAttribute("cy", "10");
          circle.setAttribute("r", "10");
          if (parseInt(result[nmIDVar], 10) < result.yellowborder) {
            circle.setAttribute("fill", "red");
          } else if (parseInt(result[nmIDVar], 10) < result.greenborder) {
            circle.setAttribute("fill", "yellow");
          } else {
            circle.setAttribute("fill", "green");
          }
          svg.appendChild(circle);
          row.querySelector('td[data-testid$=stocks]').firstChild.appendChild(svg);
        });
      }
    });
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