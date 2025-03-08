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


function updateFetchDataResp(data) {
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
    })
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