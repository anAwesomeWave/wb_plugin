function extractNmIDs() {
    const rows = document.querySelectorAll(
        'div[class^="All-goods__table"] tbody[class^="Table__tbody"] tr[role="button"][data-testid^="all-goods-table"]'
    );

    const ids = new Map(); // wbId -> index in array

    const id_list= Array.from(rows).map(row => {
        const element = row.querySelector('span[data-testid="card-nmID-text"]');
        return element ? parseInt(element.innerText.split(": ")[1], 10) : null;
    }).filter(Boolean);

    id_list.forEach(function(item, i) {
        ids[item] = i
    });

    console.log(ids);
    console.log(id_list);
    return [ids, id_list];
}

function updateStorageWbIds() {
    const [mapIdsToIndex, id_list] = extractNmIDs()

    if (mapIdsToIndex !== undefined && id_list !== undefined && id_list.length > 0) {
        console.log('Update storage!', id_list)
        chrome.storage.local.set({'wbIds': id_list});
        chrome.storage.local.set({'mapWbIdToIndex': mapIdsToIndex});
    } else {
        console.log("ERROR UPDATING STORAGE", mapIdsToIndex, id_list)
    }
}

// Настройка MutationObserver для отслеживания изменений DOM
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            updateStorageWbIds();
        }
    }
});

// Запуск наблюдения за изменениями в DOM
function startObserving() {
    const targetNode = document.body;
    const config = {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    };

    observer.observe(targetNode, config);
}

// Запуск при загрузке страницы
if (document.readyState === 'complete') {
    startObserving();
} else {
    window.addEventListener('load', startObserving);
}