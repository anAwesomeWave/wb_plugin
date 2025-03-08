chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'noTokenNotification' || request.action === "nowbIdsNotification") {
    // Создаем элемент для уведомления
    const notificationDiv = document.createElement('div');
    notificationDiv.innerText = request.message;
    // Стили для простого уведомления
    notificationDiv.style.position = 'fixed';
    notificationDiv.style.top = '10px';
    notificationDiv.style.right = '10px';
    notificationDiv.style.padding = '10px';
    notificationDiv.style.backgroundColor = '#fff';
    notificationDiv.style.border = '1px solid #000';
    notificationDiv.style.zIndex = 10000;
    document.body.appendChild(notificationDiv);

    // Убираем уведомление через 5 секунд
    setTimeout(() => {
      notificationDiv.remove();
    }, 5000);
  }
});