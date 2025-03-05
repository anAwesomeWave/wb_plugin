// Обработка сообщений для выполнения запроса
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "fetchData") {
      console.log("NEW FETCH BACKGROUND")
      // Пример API-запроса
      const apiUrl = "https://seller-analytics-api.wildberries.ru/api/v2/nm-report/detail";
      chrome.storage.local.get(['userToken', 'wbIds'], (result) => {
        console.log("My token ", result.userToken)
        if (result.userToken !== undefined) {
            // токен найден
            token = result.userToken;
            const today = new Date();
            const twoWeeksLater = new Date(today); // Создаем копию сегодняшней даты
            twoWeeksLater.setDate(today.getDate() - 14);

            const todayDatePart = today.toLocaleDateString('en-CA'); // Формат "YYYY-MM-DD"
            const todayTimePart = today.toLocaleTimeString('en-GB', { hour12: false }); // Формат "HH:MM:SS"
            const todayFormated = `${todayDatePart} ${todayTimePart}`;

            const pastdatePart = twoWeeksLater.toLocaleDateString('en-CA'); // Формат "YYYY-MM-DD"
            const pasttimePart = twoWeeksLater.toLocaleTimeString('en-GB', { hour12: false }); // Формат "HH:MM:SS"
            const pastFormated = `${pastdatePart} ${pasttimePart}`;

            const requestOptions = {
                method: "POST",  // или "GET"
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token  // Если требуется авторизация
                },
                body: JSON.stringify({  // Тело запроса (если требуется)
                    "nmIds": result.wbIDs,
                    "period": {
                        "begin": pastFormated,
                        "end": todayFormated
                    },
                    "page": 1
                })
            };

            // Выполняем запрос
            fetch(apiUrl, requestOptions)
                .then(response => response.json())
                .then(data => {
                    sendResponse({ data: data.data.cards });  // Отправляем данные обратно в popup
                })
                .catch(error => {
                    console.error("Error fetching data:", error);
                    sendResponse({ error: error.message });
                });
        } else {
            // токена нет, надо уведомить юзера
            // id - уникальное!
            console.log("NO TOKEN FOUND")
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'noTokenNotification', message: 'Токен не найден!' });
            });
        }

      });
  }
  return true;  // Необходимо для асинхронного ответа
});
