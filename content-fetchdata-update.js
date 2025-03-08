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
    let newElem = document.createElement("div")
    newElem.textContent = daysLeft
    newElem.className = "wbPluginMZ"

    // document.querySelectorAll(
    //     'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    // )[elemInd].querySelector('div[class^=Stock]').appendChild(newElem)
    document.querySelectorAll(
        'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    )[elemInd].querySelector('td[data-testid$=stocks]').firstChild.appendChild(newElem)
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

const fetchDataObserver = new MutationObserver(() => {
    document.querySelectorAll('div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr').forEach((row) => {
        if (row.querySelector("span") !== null && row.querySelector(".wbPluginMZ") === null) {
            const nmID = parseInt(row.querySelector('span[data-testid="card-nmID-text"]').innerText.split(": ")[1], 10)
            const nmIDVar = `wbId-${nmID}`
            chrome.storage.local.get([nmIDVar], (result) => {
                if (result[nmIDVar] === undefined) {
                    return
                }
                let customElement = document.createElement("div")
                customElement.textContent = result[nmIDVar]
                customElement.className = "wbPluginMZ"
                row.querySelector('td[data-testid$=stocks]').firstChild.appendChild(customElement);
                row.setAttribute('data-processed', 'true')
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

waitForElement('table[data-testid="all-goods-table"] tbody', (table) => {
    fetchDataObserver.observe(table, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
});