const OUT_ELEMS_CLASS = "wbPluginMZ"

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fetchdata') {
    // есть данные запроса ()
    // и данные и стореджа
    // для каждого пришедшего элемента мы считаем значение value = остаток (из html) / avgOrdersPerDay != 0 (из запроса)
    console.log(`NEW FETCH DATA WITH CODE ${request.code}`)
    switch (request.code) {
      case 200:
        updateFetchDataResp(request.data)
    }
  }
});


async function updateFetchDataResp(data) {
    let dataArr = data["cards"]
    console.log("Length of cards from API", data["cards"].length)
    for (let i = 0; i < dataArr.length; i ++) {
        updateSingleProduct(dataArr[i])
    }
}

function updateSingleProduct(product) {
    // 1. получаем ["nmID"] - используем дальше для получения индекса через мапу из стореджаю по этому индексу будем обновлять
    // 2. получаем ["statistics"]["avgOrdersCountPerDay"]
    // 3. получим индекс элемента на страничке по nmID
    // 4. получим сколько этого товара осталось
    const nmID = product["nmID"]
    const avgOrders = product["statistics"]["selectedPeriod"]["avgOrdersCountPerDay"]
    console.log(`UPDATE ${nmID} orders: ${avgOrders}`)
    chrome.storage.local.get(['mapWbIdToIndex', 'wbIds'], (result) => {
        if (result.mapWbIdToIndex === undefined || result.wbIds === undefined) {
            console.log("ERROR FROM updateSingleProduct ", result.mapWbIdToIndex, result.wbIds)
            return
        }
        const pageInd = result.mapWbIdToIndex[nmID] // почему-то иногда Undefined
        console.log(result.mapWbIdToIndex, nmID, `pageInd ${pageInd}`)
        const totalLeft = parseTotalRemainsForProduct(pageInd)
        console.log(`pageInd ${pageInd} totalLeft: ${totalLeft}`)
        const daysLeft = (avgOrders === 0) ? totalLeft : totalLeft / avgOrders
        updateProductElem(pageInd, daysLeft)
        chrome.storage.local.set({[`wbId-${nmID}`]: daysLeft }, function() {})
    })
}

function updateProductElem(elemInd, daysLeft) {
    const existedElems = document.querySelectorAll(
        'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    )[elemInd].querySelector('td[data-testid$=stocks]').querySelectorAll(`.${OUT_ELEMS_CLASS}`)
    existedElems[0].parentNode.removeChild(existedElems[0]);

    const svgNS = "http://www.w3.org/2000/svg"; // Пространство имен SVG
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", OUT_ELEMS_CLASS)
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
  
    // Создаем цветной круг
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "10");

    chrome.storage.local.get(['greenborder', 'yellowborder'], (result) => {
        if (parseInt(daysLeft, 10) < result.yellowborder) {
            circle.setAttribute("fill", "red"); // Цвет заливки
        } else if (parseInt(daysLeft, 10) < result.greenborder) {
            circle.setAttribute("fill", "yellow"); // Цвет заливки
        } else {
            circle.setAttribute("fill", "green"); // Цвет заливки
        }
    })
    
    // Добавляем круг в SVG
    svg.appendChild(circle);

    document.querySelectorAll(
        'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    )[elemInd].querySelector('td[data-testid$=stocks]').firstChild.appendChild(svg)
}

function parseTotalRemainsForProduct(wbListInd) {
    // для индекса собираем информацию про остаток товара (из html)
    // console.log(document.querySelectorAll(
    //     'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    // )[wbListInd])
    //     console.log(document.querySelectorAll(
    //     'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    // )[wbListInd].querySelector('td[data-testid$="stocks"]'))
    return parseInt(document.querySelectorAll(
        'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    )[wbListInd].querySelector('td[data-testid$="stocks"]').querySelector('span').innerText, 10);
}

const fetchDataObserver = new MutationObserver((mutationsList, observer) => {
    console.log("NEW MUTATION")
    const allInternal = mutationsList.every(mutation => {
        if (mutation.type === 'childList') {
            // Проверяем добавленные узлы
            for (let node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains(OUT_ELEMS_CLASS)) {
                    return false;
                }
            }
            // При необходимости можно также проверить удалённые узлы
            for (let node of mutation.removedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains(OUT_ELEMS_CLASS)) {
                    return false;
                }
            }
            return true;
        } else if (mutation.type === 'attributes') {
            // Для изменения атрибутов проверяем сам элемент
            return mutation.target.classList.contains(OUT_ELEMS_CLASS);
        }
        return false;
    });
    console.log(mutationsList, allInternal)
    document.querySelectorAll('div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr').forEach((row) => {
        if (!allInternal && !row.querySelector(`.${OUT_ELEMS_CLASS}`)) {
            // observer.disconnect()
            console.log("WEEWEE", row, row.querySelector(`.${OUT_ELEMS_CLASS}`))

            const nmID = parseInt(row.querySelector('span[data-testid="card-nmID-text"]').innerText.split(": ")[1], 10)
            const nmIDVar = `wbId-${nmID}`
            chrome.storage.local.get([nmIDVar, 'greenborder', 'yellowborder'], (result) => {
                if (result[nmIDVar] === undefined) {
                    return
                }

                const svgNS = "http://www.w3.org/2000/svg"; // Пространство имен SVG
                const svg = document.createElementNS(svgNS, "svg");
                svg.setAttribute("class", OUT_ELEMS_CLASS)
                svg.setAttribute("width", "20");
                svg.setAttribute("height", "20");
              
                // Создаем цветной круг
                const circle = document.createElementNS(svgNS, "circle");
                circle.setAttribute("cx", "10");
                circle.setAttribute("cy", "10");
                circle.setAttribute("r", "10");
            
                if (parseInt(result[nmIDVar], 10) < result.yellowborder) {
                    circle.setAttribute("fill", "red"); // Цвет заливки
                } else if (parseInt(result[nmIDVar], 10) < result.greenborder) {
                    circle.setAttribute("fill", "yellow"); // Цвет заливки
                } else {
                    circle.setAttribute("fill", "green"); // Цвет заливки
                }
                svg.appendChild(circle);

                row.querySelector('td[data-testid$=stocks]').firstChild.appendChild(svg);
                // row.setAttribute('data-processed', 'true')


                // observer.observe(document.querySelector('table[data-testid="all-goods-table"] tbody'), {
                //     childList: true,
                //     subtree: true,
                //     attributes: false,
                //     characterData: false
                // })
            })
        }
    });
});



// этот код ради проверки, что элемент прогрузился перед тем, как вешать observer на него
function waitForElement(selector, onElementFound) {
  // Check if the element already exists
  const element = document.querySelector(selector);
  if (element) {
    onElementFound(element);
    return;
  }

  // Observe the document for changes
  const observer = new MutationObserver(() => {
    const el = document.querySelector(selector);
    if (el) {
      observer.disconnect(); // Stop observing once found
      onElementFound(el);
    }
  });

  // Start observing the entire document
  observer.observe(document, {
    subtree: true,
    childList: true,
  });
}

// Usage: Wait for #myElement, then observe its mutations


function onTableFullReady() {
    console.log("Таблица полностью загружена и не изменяется.");
    // Ваш код для плагина
    const table = document.querySelector('table[data-testid="all-goods-table"] tbody')
    fetchDataObserver.observe(table, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
    triggerTableMutation(table)
}

let timer = null;
const debounceDelay = 500;

let fullLoadingObserver = new MutationObserver(function(mutationsList, observer) {
    console.log(mutationsList)
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(() => {
        onTableFullReady();
        observer.disconnect(); // отключаем наблюдатель, чтобы не вызывать повторно
    }, debounceDelay);
});


waitForElement('table[data-testid="all-goods-table"] tbody', (table) => {
    console.log("Сама таблица подгружена");
    fullLoadingObserver.observe(table, { childList: true, subtree: true, attributes: true });
});

function triggerTableMutation(table) {
  // Добавляем data-атрибут или изменяем его значение
  table.setAttribute('data-mutation', 'triggered');

  // Чтобы изменение было "мгновенным" и не оставляло следа, можно удалить атрибут через короткий промежуток времени
  setTimeout(() => {
    table.removeAttribute('data-mutation');
  }, 0);
}