const OUT_ELEMS_CLASS = "wbPluginMZ";
let isActive = false;
let fetchDataObserver = null;
let fullLoadingObserver = null;
let tableElement = null;
let messageListener = null;
let tableMutationTimer = null;
const debounceDelay = 500;
const TARGET_PAGE = "https://seller.wildberries.ru/new-goods/all-goods";
let updateInProgress = false; // Глобальный флаг блокировки

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
  tempDiv.className = 'wb-temp-mutation';
  tempDiv.style.display = 'none';
  table.appendChild(tempDiv);
  setTimeout(() => {
    if (table.contains(tempDiv)) {
      table.removeChild(tempDiv);
    }
  }, 50);
}

// =====================
// Основная логика
// =====================

async function updateDaysLeftInfo(product) {
  return new Promise((resolve) => {
    const nmID = product["nmID"];
    const avgOrders = product.statistics.selectedPeriod.avgOrdersCountPerDay;

    chrome.storage.local.get(['mapWbIdToIndex', 'wbIds'], (result) => {
      if (!result.mapWbIdToIndex || !result.wbIds) {
        console.error("Missing mapping data");
        return resolve();
      }

      const pageInd = result.mapWbIdToIndex[nmID];
      const totalLeft = parseInt(
        document.querySelectorAll(
          'div[class^="All-goods__table"] tr[data-testid^="all-goods-table"]'
        )[pageInd]?.querySelector('[data-testid$="stocks"] span')?.textContent || 0,
        10
      );

      const daysLeft = avgOrders === 0 ? totalLeft : (totalLeft / avgOrders).toFixed(1);
      chrome.storage.local.set({ [`wbId-${nmID}`]: daysLeft }, () => resolve());
    });
  });
}

async function updateFetchDataResp(data) {
  if (!data?.cards) return;

  const promises = data.cards.map(product =>
    updateDaysLeftInfo(product).catch(e => console.error("Update error:", e))
  );
  await Promise.all(promises);
}

function updateTableElements() {
  if (updateInProgress) return;
  updateInProgress = true;

  try {
    document.querySelectorAll('tr[role="button"][data-testid^="all-goods-table"]').forEach(row => {
      const nmIDElem = row.querySelector('[data-testid="card-nmID-text"]');
      if (!nmIDElem) return;

      const nmID = parseInt(nmIDElem.textContent.split(": ")[1], 10);
      if (isNaN(nmID)) return;

      const stocksCell = row.querySelector('[data-testid$="stocks"]');
      if (!stocksCell) return;

      // Очистка предыдущих элементов
      const container = stocksCell.firstElementChild;
      if (!container) return;

      container.querySelectorAll(`.${OUT_ELEMS_CLASS}`).forEach(svg => svg.remove());

      // Добавление нового элемента
      chrome.storage.local.get([`wbId-${nmID}`, 'greenborder', 'yellowborder'], (result) => {
        console.log('wbId ---- ', result[`wbId-${nmID}`], !result[`wbId-${nmID}`])
        if (result[`wbId-${nmID}`] === undefined) return;

        const color = getColorByDays(
          result[`wbId-${nmID}`],
          result.yellowborder || 5,
          result.greenborder || 10
        );

        const svg = createStatusSVG(color);
        console.log('row NMID:', nmID);
        console.log('stocksCell:', stocksCell);
        console.log('stocksCell.firstElementChild:', container);

        container.appendChild(svg);
      });
    });
  } catch (error) {
    console.error("Update error:", error);
  } finally {
    updateInProgress = false;
  }
}

// =====================
// Наблюдатели и инициализация
// =====================

function initObservers() {
  fetchDataObserver = new MutationObserver(mutations => {
    console.log("NEW MUTATION");
    const hasNewRows = mutations.some(mutation =>
      [...mutation.addedNodes].some(node =>
        node.nodeType === Node.ELEMENT_NODE &&
        node.matches('tr[data-testid^="all-goods-table"]')
      )
    );

    if (hasNewRows) {
      console.log("Обнаружены новые строки");
      setTimeout(() => {
        updateTableElements();
        triggerTableMutation(tableElement);
      }, 300);
    }
  });

  fullLoadingObserver = new MutationObserver(() => {
    clearTimeout(tableMutationTimer);
    tableMutationTimer = setTimeout(() => {
      if (tableElement) {
        console.log("таблица полностью загружена")
        fetchDataObserver.observe(tableElement, {
          childList: true,
          subtree: true,
          attributes: false
        });
        fullLoadingObserver.disconnect();
      }
    }, debounceDelay);
  });
}

function init() {
  if (isActive) return;
  isActive = true;
  console.log("Plugin init - начата инициализация");

  // Добавляем задержку для полной загрузки DOM
  setTimeout(() => {
    messageListener = async (request, sender, sendResponse) => {
      if (request.action === 'fetchdata' && request.code === 200) {
        console.log("Получены новые данные", request.data);
        await updateFetchDataResp(request.data);
        setTimeout(updateTableElements, 500);
      }
      return true;
    };

    chrome.runtime.onMessage.addListener(messageListener);
    initObservers();

    waitForElement('table[data-testid="all-goods-table"] tbody', table => {
      console.log("Таблица найдена:", table);
      tableElement = table;
      fullLoadingObserver.observe(table, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-testid']
      });
      // Первоначальное обновление элементов
      setTimeout(updateTableElements, 1000);
    });
  }, 1000); // Задержка для инициализации страницы
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

const targetPageObserver = new MutationObserver(() => {
    if (window.location.href !== targetPageObserver.lastURL) {
        targetPageObserver.lastURL = window.location.href;
        checkAndTogglePlugin();
    }
});

// Инициализация
checkAndTogglePlugin();
targetPageObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['href']
});
targetPageObserver.lastURL = window.location.href;