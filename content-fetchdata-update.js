chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fetchdata') {
    // Создаем элемент для уведомления
    console.log(`NEW FETCH DATA WITH CODE ${request.code}`)
  }
});