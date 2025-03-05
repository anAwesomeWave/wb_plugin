// Загружаем токен из хранилища при открытии popup
chrome.storage.local.get(['userToken'], function(result) {
  if (result.userToken) {
      document.getElementById('tokenInput').value = result.userToken;
  }
});

// Сохраняем токен при нажатии кнопки
document.getElementById('submitToken').addEventListener('click', function() {
  const token = document.getElementById('tokenInput').value;
  if (!token) {
      alert("Token cannot be empty!");
      return;
  }

  // Сохраняем токен в хранилище
  chrome.storage.local.set({'userToken': token }, function() {
      console.log('Token saved:', token);

      // Выводим сообщение об успехе в текстовое поле
      const outputText = document.getElementById('outputText');
      chrome.storage.sync.get(['userToken'], (result) => {
        console.log('Полученное значение:', result.userToken); // myValue
      });
      outputText.value = "Token saved successfully!\n" + outputText.value;
  });
});

document.getElementById('deleteToken').addEventListener('click', function() {

  chrome.storage.local.remove(['userToken'], function() {
    console.log('Token removed from storage.');

    // Очищаем поле ввода токена
    document.getElementById('tokenInput').value = '';

    // Выводим сообщение об успехе в текстовое поле
    const outputText = document.getElementById('outputText');
    outputText.value = "Token removed successfully!\n" + outputText.value;
});
});

// Обновление UI с количеством nmID
function updateUI() {
  chrome.storage.local.get(['wbIds'], ({ wbIds = {} }) => {
      const countElement = document.getElementById('outputText');
      
      countElement.textContent = wbIds;
  });
}

// Обновление данных при открытии popup
updateUI();
// Обновление каждые 2 секунды
setInterval(updateUI, 2000);

// Запрашиваем данные с API при нажатии кнопки
document.getElementById('fetchData').addEventListener('click', function() {
  // Отправляем сообщение в фоновый скрипт для выполнения запроса
  chrome.runtime.sendMessage({ action: "fetchData" }, function(response) {
    console.log(response.farewell);
      if (response && response.data) {
          const outputText = document.getElementById('outputText');
          outputText.value = "Fetched data:\n" + JSON.stringify(response.data, null, 2) + "\n\n" + outputText.value;
      } else {
          alert("Failed to fetch data.");
      }
  });
});