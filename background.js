// background.js - Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DevFormAutofill] Installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabId') {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }

  if (request.action === 'injectOverlay') {
    chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      files: ['content_scripts/overlay.js']
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'fillForm') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'fillForm',
        data: request.data,
        mode: request.mode || 'review'
      });
    });
    sendResponse({ success: true });
    return true;
  }

  return true;
});
