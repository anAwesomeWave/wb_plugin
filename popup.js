// Ожидаем загрузки DOM
document.addEventListener("DOMContentLoaded", function () {
  // Загружаем токен из хранилища при открытии popup
  chrome.storage.local.get(['userToken', 'timeFrom', 'greenborder', 'yellowborder'], function(result) {
      if (result.userToken) {
        document.getElementById('tokenInput').value = result.userToken;
      } 
      if (result.timeFrom && result.greenborder && result.yellowborder){
        document.getElementById('timeFrom').value = result.timeFrom;
        document.getElementById('greenborder').value = result.greenborder;
        document.getElementById('yellowborder').value = result.yellowborder;
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

  // Сохраняем токен при нажатии кнопки
  document.getElementById('submitInputs').addEventListener('click', function() {
    const timeFrom = document.getElementById('timeFrom').value;
    const greenborder = document.getElementById('greenborder').value;
    const yellowborder = document.getElementById('yellowborder').value;
    if (!timeFrom || !greenborder || !yellowborder) {
        alert("Settings fields cannot be empty!");
        return;
    }

    // Сохраняем токен в хранилище
    chrome.storage.local.set({'timeFrom': timeFrom }, function() {
        console.log('TimeFrom saved:', timeFrom);
    });
    chrome.storage.local.set({'greenborder': greenborder }, function() {
        console.log('Greenborder saved:', greenborder);
    });
    chrome.storage.local.set({'yellowborder': yellowborder }, function() {
        console.log('Yellowborder saved:', yellowborder);
    });
});

  // Обновление UI с количеством nmID
  function updateUI() {
      chrome.storage.local.get(['wbIds'], ({ wbIds = {} }) => {
          const outputText = document.getElementById('outputText');
          outputText.value = `WB ids len: ${wbIds.length}\n` + outputText.value;
      });
  }

  // Функция для переключения вкладок
  function openTab(evt, tabName) {
      var i, tabcontent, tablinks;
      tabcontent = document.getElementsByClassName("tabcontent");
      for (i = 0; i < tabcontent.length; i++) {
          tabcontent[i].style.display = "none";
      }
      tablinks = document.getElementsByClassName("tablinks");
      for (i = 0; i < tablinks.length; i++) {
          tablinks[i].className = tablinks[i].className.replace(" active", "");
      }
      document.getElementById(tabName).style.display = "block";
      evt.currentTarget.className += " active";
  }

  // Назначаем обработчики событий для кнопок вкладок
  document.getElementById("tokenTabButton").addEventListener("click", function(event) {
      openTab(event, 'TokenTab');
  });

  document.getElementById("inputTabButton").addEventListener("click", function(event) {
      openTab(event, 'InputTab');
  });

  // Открываем вкладку по умолчанию
  document.getElementById("tokenTabButton").click();

  // уже не надо как будто
  // // Обновление данных при открытии popup
  // updateUI();
  // // Обновление каждые 2 секунды
  // setInterval(updateUI, 2000);

  // Запрашиваем данные с API при нажатии кнопки
  document.getElementById('fetchData').addEventListener('click', function() {
      console.log("FETCH DATA POPUP");
      // Отправляем сообщение в фоновый скрипт для выполнения запроса
      chrome.runtime.sendMessage({ action: "fetchData" }, function(response) {
          if (response && response.data) {
              const outputText = document.getElementById('outputText');
              outputText.value = `Fetched data code ${response.code} cards: ${JSON.stringify(response.data, null, 2) + "\n\n"}` +  + outputText.value;
          } else {
              alert("Failed to fetch data.");
          }
      });
  });
});