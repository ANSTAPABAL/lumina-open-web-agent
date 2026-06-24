// App State
let chats = [];
let activeChatId = null;
let attachedFiles = [];
let isGenerating = false;
let pendingModel = null;

const DEFAULT_SETTINGS = {
  ollamaUrl: 'http://localhost:11434'
};
let settings = { ...DEFAULT_SETTINGS };

const PROXY_BASE = window.location.protocol.startsWith('http') ? '' : 'http://localhost:8000';


// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const btnNewChat = document.getElementById('btnNewChat');
const modelSelect = document.getElementById('modelSelect');
const chatListContainer = document.getElementById('chatListContainer');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsModalOverlay = document.getElementById('settingsModalOverlay');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const ollamaApiUrl = document.getElementById('ollamaApiUrl');
const ollamaUrlWrapper = document.getElementById('ollamaUrlWrapper');

const activeChatTitleInput = document.getElementById('activeChatTitleInput');
const activeModelBadge = document.getElementById('activeModelBadge');
const activeModelName = document.getElementById('activeModelName');
const messagesContainer = document.getElementById('messagesContainer');
const chatForm = document.getElementById('chatForm');
const inputAttachmentsPanel = document.getElementById('inputAttachmentsPanel');
const fileInput = document.getElementById('fileInput');
const chatTextarea = document.getElementById('chatTextarea');
const btnSendChat = document.getElementById('btnSendChat');

// Model confirmation elements
const modelConfirmOverlay = document.getElementById('modelConfirmOverlay');
const modelConfirmText = document.getElementById('modelConfirmText');
const btnConfirmSwitchCurrent = document.getElementById('btnConfirmSwitchCurrent');
const btnConfirmCreateNew = document.getElementById('btnConfirmCreateNew');
const btnConfirmCancel = document.getElementById('btnConfirmCancel');

// Folder integration elements
const btnFolderToggle = document.getElementById('btnFolderToggle');
const folderContent = document.getElementById('folderContent');
const folderPathInput = document.getElementById('folderPathInput');
const btnConnectFolder = document.getElementById('btnConnectFolder');
const folderActionsRow = document.getElementById('folderActionsRow');
const btnSortFolder = document.getElementById('btnSortFolder');
const btnRenameBatchFolder = document.getElementById('btnRenameBatchFolder');
const folderFileList = document.getElementById('folderFileList');

// Rename Modal elements
const renameModalOverlay = document.getElementById('renameModalOverlay');
const btnCloseRename = document.getElementById('btnCloseRename');
const renamePattern = document.getElementById('renamePattern');
const renameReplace = document.getElementById('renameReplace');
const renameRegex = document.getElementById('renameRegex');
const renameCase = document.getElementById('renameCase');
const renamePrefix = document.getElementById('renamePrefix');
const renameSuffix = document.getElementById('renameSuffix');
const btnExecuteRename = document.getElementById('btnExecuteRename');

// Folder Browser elements
const folderBrowserOverlay = document.getElementById('folderBrowserOverlay');
const btnBrowseFolder = document.getElementById('btnBrowseFolder');
const btnCloseFolderBrowser = document.getElementById('btnCloseFolderBrowser');
const folderBrowserCurrentPath = document.getElementById('folderBrowserCurrentPath');
const folderBrowserList = document.getElementById('folderBrowserList');
const btnFolderBrowserUp = document.getElementById('btnFolderBrowserUp');
const btnConfirmFolderBrowser = document.getElementById('btnConfirmFolderBrowser');

// Plus Actions elements
const btnPlusActions = document.getElementById('btnPlusActions');
const plusDropdown = document.getElementById('plusDropdown');
const btnPlusWorkFolder = document.getElementById('btnPlusWorkFolder');
const plusFolderModalOverlay = document.getElementById('plusFolderModalOverlay');
const btnClosePlusFolder = document.getElementById('btnClosePlusFolder');
const plusFolderPathInput = document.getElementById('plusFolderPathInput');
const btnPlusFolderBrowse = document.getElementById('btnPlusFolderBrowse');
const plusFolderPromptInput = document.getElementById('plusFolderPromptInput');
const btnPlusFolderRun = document.getElementById('btnPlusFolderRun');

// Folder states
let folderPath = '';
let folderFiles = [];
let folderBrowserPath = '';
let folderBrowserTarget = 'sidebar'; // 'sidebar' or 'plus'

// Suggested prompts for empty state
const SUGGESTED_PROMPTS = [
  {
    title: "Напиши код",
    desc: "Скрипт на Python для сортировки пузырьком с анимацией в консоли.",
    prompt: "Напиши скрипт на Python для сортировки пузырьком с выводом анимации процесса в консоли."
  },
  {
    title: "Анализ данных",
    desc: "Как визуализировать распределение посещений веб-сайта?",
    prompt: "Подскажи лучшие способы визуализации распределения посещений веб-сайта по часам и дням недели."
  },
  {
    title: "Идеи подарков",
    desc: "Что подарить коллеге-программисту на день рождения?",
    prompt: "Предложи 5 креативных и полезных идей подарка для коллеги-программиста на день рождения."
  },
  {
    title: "Редактор текста",
    desc: "Напиши вежливый отказ от предложения о сотрудничестве.",
    prompt: "Напиши вежливое письмо-отказ для HR-менеджера от оффера, так как я выбрал другую компанию."
  }
];

// Initialize App
async function init() {
  loadSettings();
  loadChats();
  setupEventListeners();
  loadFolderSettings();
  await fetchOllamaModels();
  
  if (chats.length === 0) {
    createNewChat(modelSelect.value);
  } else {
    // Set first or last active chat
    const lastActive = chats.find(c => c.active) || chats[0];
    setActiveChat(lastActive.id);
  }
  
  renderChatList();
  updateSettingsUI();
  adjustTextareaHeight();
}

// Local Storage Helper with quota-handling
function saveChatsToStorage() {
  try {
    localStorage.setItem('lumina_chats', JSON.stringify(chats));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn("Storage quota exceeded, cleaning up old large attachments...");
      // Remove base64 image data from messages older than 3 chats
      let sortedChats = [...chats].sort((a, b) => b.createdAt - a.createdAt);
      sortedChats.forEach((chat, index) => {
        if (index > 2) {
          chat.messages.forEach(msg => {
            if (msg.attachments) {
              msg.attachments.forEach(att => {
                if (att.dataUrl && att.type.startsWith('image/')) {
                  att.dataUrl = ""; // Clear base64 string to save space
                  att.isPruned = true;
                }
              });
            }
          });
        }
      });
      try {
        localStorage.setItem('lumina_chats', JSON.stringify(chats));
      } catch (retryError) {
        console.error("Failed to save even after pruning images:", retryError);
      }
    }
  }
}

// Load chats history
function loadChats() {
  const stored = localStorage.getItem('lumina_chats');
  if (stored) {
    try {
      chats = JSON.parse(stored);
    } catch (e) {
      chats = [];
    }
  }
}

function saveSettings() {
  localStorage.setItem('lumina_settings', JSON.stringify(settings));
}

function loadSettings() {
  const stored = localStorage.getItem('lumina_settings');
  if (stored) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      settings = { ...DEFAULT_SETTINGS };
    }
  }
}

// Event Listeners
function setupEventListeners() {
  // Mobile Sidebar Toggle
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar on mobile clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 820) {
      if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target) && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Create Chat
  btnNewChat.addEventListener('click', () => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat && activeChat.messages.length === 0) {
      chatTextarea.focus();
      if (window.innerWidth <= 820) {
        sidebar.classList.remove('open');
      }
      return;
    }
    const selectedModel = modelSelect.value;
    createNewChat(selectedModel);
    if (window.innerWidth <= 820) {
      sidebar.classList.remove('open');
    }
  });

  // Model Select Change Trigger
  modelSelect.addEventListener('change', () => {
    const newModel = modelSelect.value;
    const activeChat = chats.find(c => c.id === activeChatId);
    
    if (!activeChat) return;
    if (activeChat.model === newModel) return;
    
    if (activeChat.messages.length === 0) {
      // Switch immediately for empty chats
      activeChat.model = newModel;
      saveChatsToStorage();
      renderChatList();
      renderActiveChat();
    } else {
      // Switch context or create new confirmation modal
      pendingModel = newModel;
      const modelLabel = getModelReadableName(newModel);
      modelConfirmText.innerHTML = `Вы выбрали модель <strong>${modelLabel}</strong>. Желаете применить её к текущему диалогу <em>"${activeChat.title}"</em> с сохранением контекста или создать новый диалог с этой моделью?`;
      modelConfirmOverlay.classList.add('open');
    }
  });

  // Model Confirmation Modal Actions
  btnConfirmSwitchCurrent.addEventListener('click', () => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat && pendingModel) {
      activeChat.model = pendingModel;
      saveChatsToStorage();
      renderChatList();
      renderActiveChat();
    }
    modelConfirmOverlay.classList.remove('open');
    pendingModel = null;
  });

  btnConfirmCreateNew.addEventListener('click', () => {
    if (pendingModel) {
      createNewChat(pendingModel);
    }
    modelConfirmOverlay.classList.remove('open');
    pendingModel = null;
  });

  btnConfirmCancel.addEventListener('click', () => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat) {
      modelSelect.value = activeChat.model;
    }
    modelConfirmOverlay.classList.remove('open');
    pendingModel = null;
  });

  // Settings Modal Events
  btnOpenSettings.addEventListener('click', () => {
    updateSettingsUI();
    settingsModalOverlay.classList.add('open');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModalOverlay.classList.remove('open');
  });

  settingsModalOverlay.addEventListener('click', (e) => {
    if (e.target === settingsModalOverlay) {
      settingsModalOverlay.classList.remove('open');
    }
  });

  btnSaveSettings.addEventListener('click', () => {
    settings.ollamaUrl = ollamaApiUrl.value.trim() || 'http://localhost:11434';
    saveSettings();
    fetchOllamaModels().then(() => {
      renderChatList();
      renderActiveChat();
    });
    settingsModalOverlay.classList.remove('open');
  });

  // Rename Active Chat Title
  activeChatTitleInput.addEventListener('change', () => {
    const newTitle = activeChatTitleInput.value.trim();
    if (newTitle && activeChatId) {
      renameChat(activeChatId, newTitle);
    }
  });

  activeChatTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      activeChatTitleInput.blur();
    }
  });

  // Textarea input and auto resize
  chatTextarea.addEventListener('input', () => {
    adjustTextareaHeight();
  });

  chatTextarea.addEventListener('focus', () => {
    chatForm.classList.add('focused');
  });

  chatTextarea.addEventListener('blur', () => {
    chatForm.classList.remove('focused');
  });

  chatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Send button
  btnSendChat.addEventListener('click', (e) => {
    e.preventDefault();
    handleSend();
  });

  // Attachments Handling
  fileInput.addEventListener('change', (e) => {
    handleFileUpload(e.target.files);
    fileInput.value = ''; // Reset file input
  });

  // Drag and drop events on active main container
  const mainChat = document.querySelector('.chat-main');
  mainChat.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatForm.classList.add('focused');
  });

  mainChat.addEventListener('dragleave', (e) => {
    e.preventDefault();
    chatForm.classList.remove('focused');
  });

  mainChat.addEventListener('drop', (e) => {
    e.preventDefault();
    chatForm.classList.remove('focused');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  });

  // Clipboard Paste (e.g. print screen images)
  chatTextarea.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const filesToUpload = [];
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file') {
        const blob = item.getAsFile();
        if (blob) filesToUpload.push(blob);
      }
    }
    if (filesToUpload.length > 0) {
      handleFileUpload(filesToUpload);
    }
  });

  // Folder Toggle
  btnFolderToggle.addEventListener('click', () => {
    folderContent.classList.toggle('collapsed');
    btnFolderToggle.classList.toggle('collapsed');
  });

  // Connect Folder
  btnConnectFolder.addEventListener('click', () => {
    const path = folderPathInput.value.trim();
    if (path) {
      connectFolder(path);
    } else {
      alert('Введите абсолютный путь к папке.');
    }
  });

  folderPathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnConnectFolder.click();
    }
  });

  // Folder Actions
  btnSortFolder.addEventListener('click', () => {
    sortFolderFiles();
  });

  btnRenameBatchFolder.addEventListener('click', () => {
    renameModalOverlay.classList.add('open');
  });

  btnCloseRename.addEventListener('click', () => {
    renameModalOverlay.classList.remove('open');
  });

  btnExecuteRename.addEventListener('click', () => {
    executeBatchRename();
  });

  // Folder Browser Events
  btnBrowseFolder.addEventListener('click', () => {
    folderBrowserTarget = 'sidebar';
    openFolderBrowser();
  });

  btnCloseFolderBrowser.addEventListener('click', () => {
    folderBrowserOverlay.classList.remove('open');
  });

  btnFolderBrowserUp.addEventListener('click', () => {
    navigateFolderBrowserUp();
  });

  btnConfirmFolderBrowser.addEventListener('click', () => {
    confirmFolderBrowserSelection();
  });

  // Plus Actions Toggle Dropdown
  btnPlusActions.addEventListener('click', (e) => {
    e.stopPropagation();
    plusDropdown.classList.toggle('open');
  });

  // Close dropdown on click outside
  document.addEventListener('click', () => {
    plusDropdown.classList.remove('open');
  });

  plusDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Open Plus Work Folder Modal
  btnPlusWorkFolder.addEventListener('click', () => {
    plusDropdown.classList.remove('open');
    plusFolderModalOverlay.classList.add('open');
    if (folderPath) {
      plusFolderPathInput.value = folderPath;
    }
  });

  btnClosePlusFolder.addEventListener('click', () => {
    plusFolderModalOverlay.classList.remove('open');
  });

  btnPlusFolderBrowse.addEventListener('click', () => {
    folderBrowserTarget = 'plus';
    openFolderBrowser();
  });

  btnPlusFolderRun.addEventListener('click', () => {
    runPlusFolderAI();
  });

  // Folder Browser Shortcut items click listener
  document.querySelectorAll('.sidebar-shortcut-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.dataset.path;
      if (path) {
        navigateFolderBrowserTo(path);
      }
    });
  });

  initEditorEvents();
}

// UI adjustments
function adjustTextareaHeight() {
  chatTextarea.style.height = 'auto';
  chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 200) + 'px';
}

function updateSettingsUI() {
  ollamaApiUrl.value = settings.ollamaUrl || 'http://localhost:11434';
}

// Create New Chat
function createNewChat(model) {
  const id = 'chat_' + Date.now();
  const newChat = {
    id: id,
    title: 'Новый чат',
    model: model,
    messages: [],
    createdAt: Date.now(),
    active: true
  };

  // Set all other chats to inactive
  chats.forEach(c => c.active = false);
  chats.unshift(newChat);
  
  activeChatId = id;
  saveChatsToStorage();
  renderChatList();
  renderActiveChat();
  chatTextarea.focus();
}

// Delete Chat
function deleteChat(id) {
  const index = chats.findIndex(c => c.id === id);
  if (index !== -1) {
    const wasActive = chats[index].active;
    chats.splice(index, 1);
    
    if (wasActive && chats.length > 0) {
      chats[0].active = true;
      activeChatId = chats[0].id;
    } else if (chats.length === 0) {
      activeChatId = null;
    }
    
    saveChatsToStorage();
    renderChatList();
    
    if (activeChatId) {
      renderActiveChat();
    } else {
      createNewChat(modelSelect.value);
    }
  }
}

// Rename Chat
function renameChat(id, newTitle) {
  const chat = chats.find(c => c.id === id);
  if (chat) {
    chat.title = newTitle;
    saveChatsToStorage();
    renderChatList();
    // Update active chat title input if currently selected
    if (activeChatId === id) {
      activeChatTitleInput.value = newTitle;
    }
  }
}

// Set Active Chat
function setActiveChat(id) {
  chats.forEach(c => c.active = (c.id === id));
  activeChatId = id;
  saveChatsToStorage();
  
  // Keep sidebar dropdown selection matching active chat model
  const chat = chats.find(c => c.id === id);
  if (chat) {
    modelSelect.value = chat.model;
  }
  
  renderChatList();
  renderActiveChat();
}

// Helper to translate model id to friendly label
function getModelReadableName(model) {
  if (model.startsWith('ollama/')) {
    return 'Ollama: ' + model.replace('ollama/', '');
  }
  return model;
}

// Render the Left Sidebar Chat History
function renderChatList() {
  chatListContainer.innerHTML = '';
  
  if (chats.length === 0) {
    chatListContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">
        Нет сохраненных чатов
      </div>
    `;
    return;
  }

  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = `chat-item ${chat.active ? 'active' : ''}`;
    item.dataset.id = chat.id;
    
    item.innerHTML = `
      <div class="chat-item-left">
        <!-- Message Icon -->
        <svg class="chat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <div class="chat-title-wrapper">
          <div class="chat-title-text" title="${chat.title}">${chat.title}</div>
          <div class="chat-item-model">${getModelReadableName(chat.model)}</div>
        </div>
      </div>
      <div class="chat-actions">
        <!-- Rename Button -->
        <button class="chat-action-btn rename-btn" title="Переименовать">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <!-- Delete Button -->
        <button class="chat-action-btn delete-btn delete" title="Удалить">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Click events
    item.addEventListener('click', (e) => {
      // Don't switch if click is on buttons
      if (e.target.closest('.chat-action-btn')) return;
      setActiveChat(chat.id);
    });

    // Rename click
    item.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const currentTitle = chat.title;
      const val = prompt('Введите новое название диалога:', currentTitle);
      if (val !== null) {
        const cleaned = val.trim();
        if (cleaned) renameChat(chat.id, cleaned);
      }
    });

    // Delete click
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Вы уверены, что хотите удалить этот диалог?')) {
        deleteChat(chat.id);
      }
    });

    chatListContainer.appendChild(item);
  });
}

// Render the Active Chat Screen
function renderActiveChat() {
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  // Header info
  activeChatTitleInput.value = chat.title;
  activeModelName.textContent = getModelReadableName(chat.model);

  // Clear messages area
  messagesContainer.innerHTML = '';

  if (chat.messages.length === 0) {
    // Empty state
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-icon-box">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <h2 class="empty-title">Как я могу помочь?</h2>
      <p class="empty-subtitle">Спросите Lumina о чем угодно, загрузите скриншоты, графики или текстовые документы для анализа.</p>
      
      <div class="suggested-prompts-grid">
        ${SUGGESTED_PROMPTS.map((sp, idx) => `
          <div class="suggested-prompt-card" data-index="${idx}">
            <h4>${sp.title}</h4>
            <p>${sp.desc}</p>
          </div>
        `).join('')}
      </div>
    `;

    // Handle suggestion cards clicks
    emptyState.querySelectorAll('.suggested-prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = card.dataset.index;
        chatTextarea.value = SUGGESTED_PROMPTS[idx].prompt;
        adjustTextareaHeight();
        handleSend();
      });
    });

    messagesContainer.appendChild(emptyState);
  } else {
    // Render Message Log
    chat.messages.forEach(msg => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${msg.role}`;
      
      let attachmentsHTML = '';
      if (msg.attachments && msg.attachments.length > 0) {
        attachmentsHTML = `<div class="message-attachments">`;
        msg.attachments.forEach(att => {
          if (att.type.startsWith('image/')) {
            const imgSrc = att.dataUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23bbb' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";
            const prunedLabel = att.isPruned ? ' (очищено для экономии памяти)' : '';
            attachmentsHTML += `
              <img src="${imgSrc}" class="attachment-image-full" alt="${att.name}" title="${att.name}${prunedLabel}"/>
            `;
          } else {
            attachmentsHTML += `
              <div class="attachment-badge">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <div class="file-info">
                  <div class="file-name" title="${att.name}">${att.name}</div>
                  <div class="file-size">${formatBytes(att.size)}</div>
                </div>
              </div>
            `;
          }
        });
        attachmentsHTML += `</div>`;
      }

      const formattedText = parseMarkdown(msg.text, msg);

      msgDiv.innerHTML = `
        <div class="avatar-box">
          ${msg.role === 'user' ? 'U' : 'L'}
        </div>
        <div class="message-content-wrapper">
          <div class="message-bubble">
            ${attachmentsHTML}
            ${formattedText}
          </div>
          <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
      `;
      messagesContainer.appendChild(msgDiv);
    });
  }

  // Scroll to bottom
  scrollToBottom();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function smartScrollToBottom() {
  const threshold = 150;
  const isNearBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight - messagesContainer.scrollTop < threshold;
  if (isNearBottom) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// File Upload Logic
function handleFileUpload(files) {
  Array.from(files).forEach(file => {
    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isText = file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isText && !isPdf) {
      alert(`Формат файла ${file.name} не поддерживается. Разрешены только изображения и текстовые документы (txt, md, json, pdf).`);
      return;
    }

    const reader = new FileReader();

    if (isImage) {
      // Images read as base64 dataUrl
      reader.onload = (e) => {
        const fileObj = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target.result
        };
        attachedFiles.push(fileObj);
        renderAttachmentsPreview();
      };
      reader.readAsDataURL(file);
    } else {
      if (isText) {
        reader.onload = (e) => {
          const fileObj = {
            id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: null,
            content: e.target.result
          };
          attachedFiles.push(fileObj);
          renderAttachmentsPreview();
        };
        reader.readAsText(file);
      } else if (isPdf) {
        reader.onload = async (e) => {
          let pdfText = "Файл PDF загружен.";
          if (typeof pdfjsLib !== 'undefined') {
            try {
              pdfText = await extractTextFromPDF(e.target.result);
            } catch (err) {
              console.error("Error parsing PDF inside reader: ", err);
              pdfText = "Ошибка извлечения содержимого PDF.";
            }
          } else {
            console.warn("pdfjsLib is not loaded, unable to parse PDF text.");
            pdfText = "Внимание: библиотека PDF.js не загружена, текст из файла PDF не извлечен.";
          }
          
          const fileObj = {
            id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: null,
            content: pdfText
          };
          attachedFiles.push(fileObj);
          renderAttachmentsPreview();
        };
        reader.readAsArrayBuffer(file);
      }
    }
  });
}

// Helper function to extract text from a PDF ArrayBuffer
async function extractTextFromPDF(arrayBuffer) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  const maxPages = Math.min(pdf.numPages, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += `[Страница ${i}]\n${pageText}\n\n`;
  }
  
  return fullText;
}

function renderAttachmentsPreview() {
  inputAttachmentsPanel.innerHTML = '';
  
  attachedFiles.forEach(file => {
    const isImage = file.type.startsWith('image/');
    const div = document.createElement('div');
    div.className = 'preview-badge-item';
    
    let previewHTML = '';
    if (isImage) {
      previewHTML = `<img src="${file.dataUrl}" alt="${file.name}" />`;
    } else {
      previewHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      `;
    }

    div.innerHTML = `
      ${previewHTML}
      <span style="max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px;">
        ${file.name}
      </span>
      <div class="remove-preview-btn" data-id="${file.id}">✕</div>
    `;

    div.querySelector('.remove-preview-btn').addEventListener('click', () => {
      removeAttachedFile(file.id);
    });

    inputAttachmentsPanel.appendChild(div);
  });
  
  adjustTextareaHeight();
}

function removeAttachedFile(id) {
  attachedFiles = attachedFiles.filter(f => f.id !== id);
  renderAttachmentsPreview();
}

// Send Message Flow
function handleSend() {
  if (isGenerating) return;

  const text = chatTextarea.value.trim();
  if (!text && attachedFiles.length === 0) return;

  const currentChat = chats.find(c => c.id === activeChatId);
  if (!currentChat) return;

  // 1. Add User Message
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    text: text,
    attachments: [...attachedFiles],
    timestamp: Date.now()
  };

  currentChat.messages.push(userMsg);
  
  // If first message, auto-rename chat based on query
  if (currentChat.title === 'Новый чат' && text) {
    currentChat.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
  }

  // Clear inputs
  chatTextarea.value = '';
  attachedFiles = [];
  inputAttachmentsPanel.innerHTML = '';
  adjustTextareaHeight();
  
  saveChatsToStorage();
  renderChatList();
  renderActiveChat();

  // 2. Stream AI Response
  streamAssistantResponse(currentChat.id, userMsg.text, userMsg.attachments);
}

// AI Assistant Response Generation (Router: Local Ollama only)
async function streamAssistantResponse(chatId, userText, files) {
  const currentChat = chats.find(c => c.id === chatId);
  if (!currentChat) return;

  isGenerating = true;
  btnSendChat.style.opacity = '0.5';
  btnSendChat.style.pointerEvents = 'none';

  // Append empty assistant message for streaming effect
  const assistantMsgId = 'msg_' + Date.now();
  const assistantMsg = {
    id: assistantMsgId,
    role: 'assistant',
    text: '',
    timestamp: Date.now()
  };
  currentChat.messages.push(assistantMsg);
  
  // Render structure & set active typing indicator
  renderActiveChat();
  
  const lastBubbleWrapper = messagesContainer.lastElementChild.querySelector('.message-bubble');
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  lastBubbleWrapper.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  let finalResponse = '';

  try {
    typingIndicator.remove();
    const modelName = currentChat.model;
    
    if (modelName.startsWith('ollama/')) {
      finalResponse = await callOllamaAPI(modelName, userText, files, lastBubbleWrapper);
    } else {
      finalResponse = "Ошибка: Выбранная модель не поддерживается локальным сервером Ollama. Пожалуйста, убедитесь, что модель установлена в Ollama.";
      lastBubbleWrapper.innerHTML = `<p style="color: #ef4444; font-weight: 500;">${finalResponse}</p>`;
    }
  } catch (err) {
    console.error("API Call error: ", err);
    finalResponse = `Произошла ошибка при выполнении запроса к Ollama: ${err.message || err}. Убедитесь, что Ollama запущена и CORS разрешен (OLLAMA_ORIGINS="*").`;
    if (typingIndicator) typingIndicator.remove();
    lastBubbleWrapper.innerHTML = `<p style="color: #ef4444; font-weight: 500;">${finalResponse}</p>`;
  }

  // Update memory and store
  assistantMsg.text = finalResponse;
  saveChatsToStorage();
  
  // Final stable render
  renderActiveChat();
  
  isGenerating = false;
  btnSendChat.style.opacity = '1';
  btnSendChat.style.pointerEvents = 'auto';
  chatTextarea.focus();
}

// Helpers
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Lightweight Custom Markdown Parser
function parseMarkdown(text, msg = null) {
  if (!text) return "";
  let html = text;
  
  // Escape HTML tags to prevent XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let actionCounter = 0;
  let groupCounter = 0;

  // Check for local file action cards before general code blocks
  html = html.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, function(match, jsonStr) {
    try {
      const decodedJson = jsonStr
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      
      // Clean up trailing commas in objects and arrays to make parsing robust against minor LLM typos
      let cleanJson = decodedJson.trim();
      cleanJson = cleanJson.replace(/,(\s*[\]}])/g, '$1');
      
      const parsed = JSON.parse(cleanJson);
      
      const actions = Array.isArray(parsed) ? parsed : [parsed];
      const isFileAction = actions.every(item => item && item.type === 'file_action');
      
      if (!isFileAction) {
        return `<pre><code>${jsonStr}</code></pre>`;
      }
      
      const groupKey = msg && msg.id ? (msg.id + '_group_' + groupCounter) : ('group_' + Math.random().toString(36).substr(2, 9));
      groupCounter++;
      
      let cardsHtml = `<div class="action-group-container" data-group="${groupKey}">`;
      const groupActionIds = [];
      let hasUnexecuted = false;
      
      actions.forEach((actionObj) => {
        const currentActionIndex = actionCounter;
        actionCounter++;
        
        const isExecuted = msg && msg.executedActions && msg.executedActions.includes(currentActionIndex);
        if (!isExecuted) {
          hasUnexecuted = true;
        }
        
        const actionId = msg && msg.id ? (msg.id + '_' + currentActionIndex) : ('action_' + Math.random().toString(36).substr(2, 9));
        groupActionIds.push(actionId);
        
        if (!window.aiActions) window.aiActions = {};
        window.aiActions[actionId] = { action: actionObj, msgId: msg ? msg.id : null, index: currentActionIndex, groupKey: groupKey };
        
        let paramsDisplay = '';
        if (actionObj.params) {
          paramsDisplay = `<pre class="action-card-params">${JSON.stringify(actionObj.params, null, 2)}</pre>`;
        }
        
        let actionTitle = 'Действие с файлами';
        let borderLeftColor = 'var(--accent-primary)';
        if (actionObj.action === 'sort') {
          actionTitle = '📁 Сортировка';
          borderLeftColor = 'var(--accent-secondary)';
        } else if (actionObj.action === 'rename') {
          actionTitle = '✏️ Переименование';
          borderLeftColor = '#8b5cf6';
        } else if (actionObj.action === 'delete') {
          actionTitle = '🗑️ Удаление';
          borderLeftColor = '#ef4444';
        } else if (actionObj.action === 'format') {
          actionTitle = '📝 Форматирование';
          borderLeftColor = '#10b981';
        } else if (actionObj.action === 'format_docx') {
          actionTitle = '📑 ГОСТ Формат';
          borderLeftColor = '#059669';
        } else if (actionObj.action === 'create_file') {
          actionTitle = '➕ Создание файла';
          borderLeftColor = '#3b82f6';
        }
        
        let buttonOrStatus = '';
        if (isExecuted) {
          buttonOrStatus = `
            <div class="action-card-status success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Внесено
            </div>
          `;
        } else {
          buttonOrStatus = `
            <button class="btn-execute-action" onclick="event.stopPropagation(); executeAiAction('${actionId}')">
              Принять
            </button>
          `;
        }

        cardsHtml += `
          <div class="action-card" id="${actionId}" style="border-left-color: ${borderLeftColor};" onclick="toggleCardParams(event, '${actionId}')">
            <div class="action-card-header">
              <span>${actionTitle} <span class="params-toggle-arrow">▼</span></span>
            </div>
            <div class="action-card-desc"><strong>Задача:</strong> ${actionObj.description || 'Выполнить локальные изменения в рабочей папке.'}</div>
            ${paramsDisplay}
            <div class="action-card-footer">
              ${buttonOrStatus}
            </div>
          </div>
        `;
      });
      
      if (!window.actionGroups) window.actionGroups = {};
      window.actionGroups[groupKey] = groupActionIds;
      
      if (actions.length > 1 && hasUnexecuted) {
        cardsHtml += `
          <button class="btn-execute-all" data-group="${groupKey}" onclick="executeAllActionsInGroup('${groupKey}')">
            ✓ Подтвердить все (${actions.length})
          </button>
        `;
      }
      
      cardsHtml += '</div>';
      return cardsHtml;
    } catch (e) {
      return `<pre><code>${jsonStr}</code></pre>`;
    }
  });

  // Code blocks: ```language ... ```
  html = html.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]+?)\n```/g, '<pre><code>$1</code></pre>');
  
  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Bullet lists: - text
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  // Wrap list items
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  // Cleanup duplicates inside pre blocks
  html = html.replace(/<pre><code>([\s\S]+?)<\/code><\/pre>/g, function(match, codeContent) {
    return '<pre><code>' + codeContent.replace(/<br>/g, '\n') + '</code></pre>';
  });

  return html;
}

// Dynamic model fetching from local Ollama tags via proxy
async function fetchOllamaModels() {
  const optGroup = document.getElementById('ollamaOptGroup');
  if (!optGroup) return;

  try {
    const url = PROXY_BASE + '/ollama-api/api/tags';
    const response = await fetch(url, {
      headers: {
        'X-Ollama-Host': settings.ollamaUrl || 'http://localhost:11434'
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.models && data.models.length > 0) {
        optGroup.innerHTML = ''; // clear default hardcoded choices
        data.models.forEach((model, index) => {
          const option = document.createElement('option');
          option.value = 'ollama/' + model.name;
          option.textContent = 'Ollama: ' + model.name;
          if (index === 0) option.selected = true;
          optGroup.appendChild(option);
        });
        console.log(`Successfully fetched ${data.models.length} models from local Ollama via proxy.`);
      }
    }
  } catch (e) {
    console.warn("Could not retrieve models from Ollama api/tags via proxy (Ollama offline or proxy error).", e);
  }
}

// Ollama Chat API handler (multimodal and streams) via proxy
async function callOllamaAPI(modelName, promptText, attachments, outputElement) {
  const url = PROXY_BASE + '/ollama-api/api/chat';
  const ollamaAddress = settings.ollamaUrl || 'http://localhost:11434';
  
  const chat = chats.find(c => c.id === activeChatId);
  const recentMessages = chat.messages.slice(-10, -1);
  
  const messages = [];
  
  recentMessages.forEach(msg => {
    let content = msg.text;
    const msgImages = [];
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        if (att.type.startsWith('image/') && att.dataUrl) {
          const base64Data = att.dataUrl.split(',')[1];
          msgImages.push(base64Data);
        } else if (att.content) {
          content += `\n\n[Содержимое файла ${att.name}]:\n${att.content}`;
        }
      });
    }
    const apiMsg = {
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: content
    };
    if (msgImages.length > 0) {
      apiMsg.images = msgImages;
    }
    messages.push(apiMsg);
  });

  let currentContent = promptText;
  const imageBase64s = [];
  
  attachments.forEach(att => {
    if (att.type.startsWith('image/') && att.dataUrl) {
      const base64Data = att.dataUrl.split(',')[1];
      imageBase64s.push(base64Data);
    } else if (att.content) {
      currentContent += `\n\n[Содержимое файла ${att.name}]:\n${att.content}`;
    }
  });

  const finalMsg = {
    role: 'user',
    content: currentContent
  };
  
  if (imageBase64s.length > 0) {
    finalMsg.images = imageBase64s;
  }
  
  messages.push(finalMsg);

  const actualModelName = modelName.replace('ollama/', '');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Ollama-Host': ollamaAddress
    },
    body: JSON.stringify({
      model: actualModelName,
      messages: messages,
      stream: true,
      options: {
        num_ctx: 32768
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API Error (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let finalResponse = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      
      try {
        const parsed = JSON.parse(cleanLine);
        const delta = parsed.message?.content;
        if (delta) {
          finalResponse += delta;
          outputElement.innerHTML = parseMarkdown(finalResponse);
          smartScrollToBottom();
        }
      } catch (e) {
        // Skip incomplete json line
      }
    }
  }

  return finalResponse;
}

// Folder Settings & API Helpers
function loadFolderSettings() {
  folderPath = localStorage.getItem('lumina_folder_path') || '';
  if (folderPath) {
    folderPathInput.value = folderPath;
    connectFolder(folderPath);
  }
}

async function connectFolder(path) {
  if (!path) return;
  
  try {
    const response = await fetch(PROXY_BASE + '/api/folder?path=' + encodeURIComponent(path));
    if (response.ok) {
      const data = await response.json();
      folderPath = data.path;
      folderFiles = data.files;
      localStorage.setItem('lumina_folder_path', folderPath);
      folderActionsRow.style.display = 'flex';
      renderFolderFiles();
    } else {
      const err = await response.json();
      alert('Ошибка: ' + (err.error || 'Не удалось подключить папку'));
      folderActionsRow.style.display = 'none';
      folderFileList.innerHTML = `<div class="folder-empty-state">Ошибка подключения</div>`;
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось связаться с сервером. Убедитесь, что server.py запущен.');
    folderActionsRow.style.display = 'none';
    folderFileList.innerHTML = `<div class="folder-empty-state">Сервер не отвечает</div>`;
  }
}

function renderFolderFiles() {
  folderFileList.innerHTML = '';
  
  if (folderFiles.length === 0) {
    folderFileList.innerHTML = `<div class="folder-empty-state">Папка пуста</div>`;
    return;
  }
  
  folderFiles.forEach(file => {
    const item = document.createElement('div');
    item.className = 'folder-file-item';
    
    let iconSVG = '';
    if (file.isDir) {
      iconSVG = `<svg class="folder-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #eab308;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    } else {
      const docExts = ['.txt', '.md', '.pdf', '.docx', '.doc'];
      const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      if (docExts.includes(file.ext)) {
        iconSVG = `<svg class="folder-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
      } else if (imgExts.includes(file.ext)) {
        iconSVG = `<svg class="folder-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
      } else {
        iconSVG = `<svg class="folder-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
      }
    }
    
    const isDoc = ['.txt', '.md', '.docx', '.doc'].includes(file.ext);
    
    item.innerHTML = `
      <div class="folder-file-item-left" style="cursor: ${isDoc ? 'pointer' : 'default'};">
        ${iconSVG}
        <span class="folder-file-name" title="${file.name}">${file.name}</span>
      </div>
      ${isDoc ? `
        <div class="folder-file-actions">
          <button class="folder-file-action-btn format-gost-btn" title="Отформатировать по ГОСТ">ГОСТ</button>
        </div>
      ` : ''}
    `;
    
    if (isDoc) {
      const fullPath = folderPath + '/' + file.name;
      item.querySelector('.folder-file-item-left').addEventListener('click', () => {
        openFileInEditor(fullPath);
      });
      item.querySelector('.format-gost-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        formatSingleFile(fullPath, 'gost').then(() => {
          if (editorFilepath.textContent === fullPath) {
            openFileInEditor(fullPath);
          }
        });
      });
    }
    
    folderFileList.appendChild(item);
  });
}

async function formatSingleFile(filePath, rule) {
  try {
    const response = await fetch(PROXY_BASE + '/api/file/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, rule })
    });
    if (response.ok) {
      alert('Файл успешно отформатирован!');
      connectFolder(folderPath);
    } else {
      const err = await response.json();
      alert('Ошибка форматирования: ' + (err.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось связаться с сервером для форматирования.');
  }
}

async function sortFolderFiles() {
  if (!confirm('Вы уверены, что хотите разложить файлы по папкам-категориям (documents, images, code и т.д.)?')) {
    return;
  }
  
  try {
    const response = await fetch(PROXY_BASE + '/api/folder/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    if (response.ok) {
      const data = await response.json();
      alert(`Сортировка завершена! Перемещено файлов: ${data.moved.length}`);
      connectFolder(folderPath);
    } else {
      const err = await response.json();
      alert('Ошибка при сортировке: ' + (err.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Сервер не отвечает.');
  }
}

async function executeBatchRename() {
  const pattern = renamePattern.value;
  const replace = renameReplace.value;
  const isRegex = renameRegex.checked;
  const caseMode = renameCase.value;
  const prefix = renamePrefix.value;
  const suffix = renameSuffix.value;
  
  try {
    const response = await fetch(PROXY_BASE + '/api/folder/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: folderPath,
        pattern,
        replace,
        regex: isRegex,
        caseMode,
        prefix,
        suffix
      })
    });
    if (response.ok) {
      const data = await response.json();
      alert(`Переименование завершено! Модифицировано файлов: ${data.renamed.length}`);
      renameModalOverlay.classList.remove('open');
      connectFolder(folderPath);
    } else {
      const err = await response.json();
      alert('Ошибка переименования: ' + (err.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Сервер не отвечает.');
  }
}

window.executeAiAction = async function(actionId) {
  const card = document.getElementById(actionId);
  if (!card) return;
  
  const actionData = window.aiActions[actionId];
  if (!actionData) return;
  const actionObj = actionData.action;
  
  const btn = card.querySelector('.btn-execute-action');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Выполнение...';
  }
  
  try {
    let response;
    let url = '';
    const bodyParams = { ...actionObj.params };
    
    if (!bodyParams.path) {
      bodyParams.path = folderPath;
    }
    
    if (actionObj.action === 'sort') {
      url = PROXY_BASE + '/api/folder/sort';
    } else if (actionObj.action === 'rename') {
      url = PROXY_BASE + '/api/folder/rename';
    } else if (actionObj.action === 'delete') {
      url = PROXY_BASE + '/api/folder/delete';
    } else if (actionObj.action === 'format') {
      url = PROXY_BASE + '/api/file/format';
      if (!bodyParams.filePath && bodyParams.file) {
        bodyParams.filePath = bodyParams.path + '/' + bodyParams.file;
      }
    } else if (actionObj.action === 'format_docx') {
      url = PROXY_BASE + '/api/folder/format_docx';
    } else if (actionObj.action === 'create_file') {
      url = PROXY_BASE + '/api/file/create';
    }
    
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyParams)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (folderPath) {
        connectFolder(folderPath);
      }
      
      if (actionData.msgId !== null) {
        const chat = chats.find(c => c.id === activeChatId);
        if (chat) {
          const msg = chat.messages.find(m => m.id === actionData.msgId);
          if (msg) {
            if (!msg.executedActions) {
              msg.executedActions = [];
            }
            if (!msg.executedActions.includes(actionData.index)) {
              msg.executedActions.push(actionData.index);
            }
          }
        }
      }
      
      const statusDiv = document.createElement('div');
      statusDiv.className = 'action-card-status success';
      statusDiv.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Изменения успешно внесены!
      `;
      btn.replaceWith(statusDiv);
      
      appendSystemMessage(`Действие "${actionObj.description || actionObj.action}" выполнено успешно.`);
    } else {
      const err = await response.json();
      showActionError(card, btn, err.error || 'Ошибка выполнения на сервере');
    }
  } catch (e) {
    console.error(e);
    showActionError(card, btn, 'Не удалось соединиться с сервером');
  }
};

window.executeAllActionsInGroup = async function(groupKey) {
  const actionIds = window.actionGroups[groupKey];
  if (!actionIds || actionIds.length === 0) return;
  
  const btnAll = document.querySelector(`.btn-execute-all[data-group="${groupKey}"]`);
  if (btnAll) {
    btnAll.disabled = true;
    btnAll.textContent = 'Выполнение...';
  }
  
  let executedCount = 0;
  
  for (const actionId of actionIds) {
    const actionData = window.aiActions[actionId];
    if (!actionData) continue;
    
    const chat = chats.find(c => c.id === activeChatId);
    if (chat && actionData.msgId !== null) {
      const msg = chat.messages.find(m => m.id === actionData.msgId);
      if (msg && msg.executedActions && msg.executedActions.includes(actionData.index)) {
        continue; // already executed
      }
    }
    
    const actionObj = actionData.action;
    let url = '';
    const bodyParams = { ...actionObj.params };
    
    if (!bodyParams.path) {
      bodyParams.path = folderPath;
    }
    
    if (actionObj.action === 'sort') {
      url = PROXY_BASE + '/api/folder/sort';
    } else if (actionObj.action === 'rename') {
      url = PROXY_BASE + '/api/folder/rename';
    } else if (actionObj.action === 'delete') {
      url = PROXY_BASE + '/api/folder/delete';
    } else if (actionObj.action === 'format') {
      url = PROXY_BASE + '/api/file/format';
      if (!bodyParams.filePath && bodyParams.file) {
        bodyParams.filePath = bodyParams.path + '/' + bodyParams.file;
      }
    } else if (actionObj.action === 'format_docx') {
      url = PROXY_BASE + '/api/folder/format_docx';
    } else if (actionObj.action === 'create_file') {
      url = PROXY_BASE + '/api/file/create';
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyParams)
      });
      
      if (response.ok) {
        if (actionData.msgId !== null && chat) {
          const msg = chat.messages.find(m => m.id === actionData.msgId);
          if (msg) {
            if (!msg.executedActions) {
              msg.executedActions = [];
            }
            if (!msg.executedActions.includes(actionData.index)) {
              msg.executedActions.push(actionData.index);
            }
          }
        }
        executedCount++;
      }
    } catch (e) {
      console.error('Error executing action inside group:', e);
    }
  }
  
  if (folderPath) {
    connectFolder(folderPath);
  }
  
  if (executedCount > 0) {
    appendSystemMessage(`Пакетное действие выполнено успешно. Применено изменений: ${executedCount}.`);
  } else {
    if (btnAll) {
      btnAll.disabled = false;
      btnAll.textContent = 'Повторить попытку';
    }
  }
};

window.toggleCardParams = function(event, actionId) {
  if (event.target.closest('.btn-execute-action') || 
      event.target.closest('.action-card-status') || 
      event.target.closest('.action-card-params') || 
      event.target.closest('.action-card-footer') || 
      event.target.closest('button')) {
    return;
  }
  const card = document.getElementById(actionId);
  if (card) {
    card.classList.toggle('params-expanded');
    const arrow = card.querySelector('.params-toggle-arrow');
    if (arrow) {
      if (card.classList.contains('params-expanded')) {
        arrow.textContent = '▲';
      } else {
        arrow.textContent = '▼';
      }
    }
  }
};

function showActionError(card, btn, msg) {
  const statusDiv = document.createElement('div');
  statusDiv.className = 'action-card-status error';
  statusDiv.innerHTML = `✕ Ошибка: ${msg}`;
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Повторить попытку';
    const existingError = card.querySelector('.action-card-status.error');
    if (existingError) existingError.remove();
    card.appendChild(statusDiv);
  }
}

function appendSystemMessage(text) {
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!activeChat) return;
  
  const sysMsg = {
    id: 'msg_sys_' + Date.now(),
    role: 'assistant',
    text: `⚙️ **Системное сообщение:** ${text}`,
    timestamp: Date.now()
  };
  
  activeChat.messages.push(sysMsg);
  saveChatsToStorage();
  renderActiveChat();
}

async function openFolderBrowser() {
  try {
    const handle = await window.showDirectoryPicker();
    if (!handle) return;
    
    const folderName = handle.name;
    const sampleFiles = [];
    
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        sampleFiles.push(entry.name);
      }
      if (sampleFiles.length >= 15) break;
    }
    
    const targetInput = folderBrowserTarget === 'plus' ? plusFolderPathInput : folderPathInput;
    const originalValue = targetInput.value;
    targetInput.value = 'Определение пути к папке...';
    targetInput.disabled = true;
    
    const response = await fetch(PROXY_BASE + '/api/folder/locate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName, sampleFiles })
    });
    
    targetInput.disabled = false;
    
    if (response.ok) {
      const data = await response.json();
      const absolutePath = data.path;
      targetInput.value = absolutePath;
      
      localStorage.setItem('lumina_folder_path', absolutePath);
      if (folderBrowserTarget === 'sidebar') {
        connectFolder(absolutePath);
      }
    } else {
      const err = await response.json();
      targetInput.value = originalValue;
      alert('Ошибка при определении пути папки на сервере: ' + (err.error || 'Не найдена'));
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      alert('Браузер отклонил запрос или не поддерживает выбор папок.');
    }
  }
}

async function navigateFolderBrowserTo(path) {
  if (!path) return;
  
  folderBrowserCurrentPath.textContent = path;
  folderBrowserPath = path;
  
  // Highlight active shortcut if it matches current path
  document.querySelectorAll('.sidebar-shortcut-item').forEach(item => {
    const shortcutPath = item.dataset.path.replace(/\/$/, '');
    const currentPath = path.replace(/\/$/, '');
    if (shortcutPath === currentPath) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  folderBrowserList.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted);">Загрузка папок...</div>`;
  
  try {
    const response = await fetch(PROXY_BASE + '/api/folder?path=' + encodeURIComponent(path));
    if (response.ok) {
      const data = await response.json();
      folderBrowserList.innerHTML = '';
      
      const subdirs = data.files.filter(f => f.isDir);
      
      if (subdirs.length === 0) {
        folderBrowserList.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">Подпапки отсутствуют</div>`;
        return;
      }
      
      subdirs.forEach(dir => {
        const item = document.createElement('div');
        item.className = 'folder-browser-item';
        item.innerHTML = `
          <div class="folder-browser-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="folder-browser-item-name">${dir.name}</div>
        `;
        
        item.addEventListener('click', () => {
          document.querySelectorAll('.folder-browser-item').forEach(i => {
            i.classList.remove('selected');
          });
          item.classList.add('selected');
        });
        
        item.addEventListener('dblclick', () => {
          const nextPath = joinPaths(folderBrowserPath, dir.name);
          navigateFolderBrowserTo(nextPath);
        });
        
        folderBrowserList.appendChild(item);
      });
    } else {
      folderBrowserList.innerHTML = `<div style="padding: 12px; text-align: center; color: #ef4444; font-size: 13px;">Ошибка загрузки папки</div>`;
    }
  } catch (err) {
    console.error(err);
    folderBrowserList.innerHTML = `<div style="padding: 12px; text-align: center; color: #ef4444; font-size: 13px;">Сервер не отвечает</div>`;
  }
}

function navigateFolderBrowserUp() {
  if (folderBrowserPath === '/' || !folderBrowserPath) return;
  
  const parts = folderBrowserPath.split('/');
  parts.pop();
  let parentPath = parts.join('/');
  if (parentPath === '') parentPath = '/';
  
  navigateFolderBrowserTo(parentPath);
}

function confirmFolderBrowserSelection() {
  let finalPath = folderBrowserPath;
  const selectedItem = folderBrowserList.querySelector('.folder-browser-item.selected');
  if (selectedItem) {
    const dirName = selectedItem.querySelector('.folder-browser-item-name').textContent;
    finalPath = joinPaths(folderBrowserPath, dirName);
  }
  
  if (finalPath) {
    if (folderBrowserTarget === 'plus') {
      plusFolderPathInput.value = finalPath;
    } else {
      folderPathInput.value = finalPath;
      connectFolder(finalPath);
    }
  }
  folderBrowserOverlay.classList.remove('open');
}

function joinPaths(base, child) {
  if (!base) return '/' + child;
  if (base.endsWith('/')) return base + child;
  return base + '/' + child;
}

// Plus actions functions & validation
function isSystemOrDangerousPath(path) {
  if (!path) return true;
  const cleanPath = path.trim().toLowerCase().replace(/\/$/, '');
  
  if (cleanPath === '' || cleanPath === '/' || cleanPath === '\\' || /^[a-z]:\\?$/.test(cleanPath)) {
    return true;
  }
  
  const dangerous = [
    '/boot', '/dev', '/etc', '/lib', '/lib64', '/proc', '/sys', '/bin', '/sbin', '/usr', '/var', '/root',
    'c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\users\\public', 'c:\\recovery',
    'c:\\system volume information', 'c:\\windows.old'
  ];
  
  const normalizedPath = cleanPath.replace(/\//g, '\\');
  
  for (let d of dangerous) {
    const normalizedD = d.toLowerCase().replace(/\//g, '\\');
    if (normalizedPath === normalizedD || normalizedPath.startsWith(normalizedD + '\\')) {
      return true;
    }
  }
  
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length <= 2 && !cleanPath.includes('\\')) {
    return true;
  }
  
  if (cleanPath.includes('\\')) {
    const winParts = cleanPath.split('\\').filter(Boolean);
    if (winParts[0] && winParts[0].endsWith(':')) {
      if (winParts.length <= 3) return true;
    } else {
      if (winParts.length <= 2) return true;
    }
  }
  
  return false;
}

async function runPlusFolderAI() {
  const path = plusFolderPathInput.value.trim();
  const promptText = plusFolderPromptInput.value.trim();
  
  if (!path) {
    alert('Укажите путь к папке.');
    return;
  }
  
  if (!promptText) {
    alert('Опишите задачу для ИИ.');
    return;
  }
  
  if (isSystemOrDangerousPath(path)) {
    alert('Внимание: Выбранная папка является системной или корневой. Операции в ней заблокированы из соображений безопасности.');
    return;
  }
  
  const currentChat = chats.find(c => c.id === activeChatId);
  if (!currentChat) {
    alert('Нет активного чата.');
    return;
  }
  
  const btnRun = document.getElementById('btnPlusFolderRun');
  btnRun.disabled = true;
  btnRun.textContent = 'Анализ...';
  
  try {
    const response = await fetch(PROXY_BASE + '/api/folder?path=' + encodeURIComponent(path));
    if (!response.ok) {
      const err = await response.json();
      alert('Ошибка при чтении папки: ' + (err.error || 'Неизвестная ошибка'));
      btnRun.disabled = false;
      btnRun.textContent = 'Запустить анализ ИИ';
      return;
    }
    
    const data = await response.json();
    const files = data.files;
    
    const filesStr = files.length === 0
      ? '(Папка пуста)'
      : files.map(f => `- ${f.name} (${f.isDir ? 'Папка' : 'Файл'}${!f.isDir ? ', ' + formatBytes(f.size) : ''})`).join('\n');
    
    plusFolderModalOverlay.classList.remove('open');
    btnRun.disabled = false;
    btnRun.textContent = 'Запустить анализ ИИ';
    plusFolderPromptInput.value = '';
    
    folderPathInput.value = path;
    connectFolder(path);
    
    const instructionSuffix = `\n\n[Системная инструкция: Проанализируй файлы в папке и задачу пользователя. Обязательно составь план действий в формате JSON-блока. Формат вывода JSON-блока должен быть строго следующим (не пиши лишнего текста вне блока, если это возможно, либо размести JSON-блок внутри стандартного markdown-блока \`\`\`json ... \`\`\`):
\`\`\`json
{
  "type": "file_action",
  "action": "sort" | "rename" | "delete" | "format_docx" | "create_file",
  "description": "Описание действий на русском языке",
  "params": {
    "path": "${path.replace(/\\/g, '\\\\')}"
  }
}
\`\`\`
Где:
- Для сортировки: "action": "sort", "params": { "path": "..." }
- Для переименования (без изменения содержимого): "action": "rename", "params": { "path": "...", "pattern": "поиск", "replace": "замена", "regex": false }
- Для удаления файлов: "action": "delete", "params": { "path": "...", "files": ["файл1.txt", "файл2.log"] }
- Для форматирования .docx по ГОСТ: "action": "format_docx", "params": { "path": "..." }
- Для создания, наполнения, изменения или переименования с наполнением файла (текстового или .docx) в одно действие: "action": "create_file", "params": { "path": "...", "filename": "имя_файла.docx", "content": "содержимое файла", "old_filename": "старое_имя_файла.docx (если нужно переименовать/заменить существующий файл и удалить оригинал)" }

ВАЖНО:
1. По умолчанию ВСЕ генерируемые тексты, стихи, рэп, описание действий и файлы должны быть строго на русском языке!
2. Используй исключительно двойные кавычки (") для ключей и строковых значений в JSON. Одинарные кавычки (') внутри JSON недопустимы!
3. Поле "content" должно содержать полный, детальный текст/код целиком без сокращений, пропусков, заглушек и плейсхолдеров (например, НЕ пиши "[Текст рэпа о Толстом...]", пиши все 100 строк рэпа целиком прямо в поле "content").
4. Если пользователь просит создать "док", "документ" или "doc", ВСЕГДА используй расширение ".docx" для имени создаваемого файла (например, "rap_tolstoy.docx" вместо "rap_tolstoy.txt").
5. Если задача требует выполнения нескольких действий (например, создать 3 отдельных файла для разных авторов), выводи их строго в виде МАССИВА JSON-объектов: [ { "type": "file_action", ... }, { "type": "file_action", ... } ]. Одно действие - один объект в массиве!
]`;

    const chatMessageText = `📁 **Интеллектуальная работа с папкой:** \`${path}\`\n**Задача:** ${promptText}\n\n**Список файлов в папке:**\n${filesStr}${instructionSuffix}`;
    
    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: chatMessageText,
      attachments: [],
      timestamp: Date.now()
    };
    
    currentChat.messages.push(userMsg);
    
    if (currentChat.title === 'Новый чат') {
      currentChat.title = `Папка: ${path.split('/').pop() || path}`;
    }
    
    saveChatsToStorage();
    renderChatList();
    renderActiveChat();
    
    streamAssistantResponse(currentChat.id, userMsg.text, []);
    
  } catch (err) {
    console.error(err);
    alert('Не удалось выполнить анализ ИИ: ' + err.message);
    btnRun.disabled = false;
    btnRun.textContent = 'Запустить анализ ИИ';
  }
}

// Document Editor / Word Simulator logic
const editorSidePanel = document.getElementById('editorSidePanel');
const editorTitle = document.getElementById('editorTitle');
const editorFilepath = document.getElementById('editorFilepath');
const btnEditorClose = document.getElementById('btnEditorClose');
const btnEditorSave = document.getElementById('btnEditorSave');
const btnEditorGost = document.getElementById('btnEditorGost');
const selectEditorFont = document.getElementById('selectEditorFont');
const selectEditorSize = document.getElementById('selectEditorSize');
const selectEditorSpacing = document.getElementById('selectEditorSpacing');
const selectEditorAlign = document.getElementById('selectEditorAlign');
const editorWordPage = document.getElementById('editorWordPage');
const editorWordPageContent = document.getElementById('editorWordPageContent');

function initEditorEvents() {
  btnEditorClose.addEventListener('click', () => {
    editorSidePanel.classList.remove('open');
  });
  
  btnEditorSave.addEventListener('click', () => {
    saveEditorFile();
  });
  
  btnEditorGost.addEventListener('click', () => {
    applyGostVisualStyles();
    const filePath = editorFilepath.textContent;
    if (filePath) {
      formatSingleFile(filePath, 'gost').then(() => {
        openFileInEditor(filePath);
      });
    }
  });
  
  selectEditorFont.addEventListener('change', (e) => {
    editorWordPageContent.style.fontFamily = e.target.value;
    btnEditorGost.classList.remove('gost-active');
  });
  
  selectEditorSize.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === '12pt') editorWordPageContent.style.fontSize = '16px';
    else if (val === '14pt') editorWordPageContent.style.fontSize = '18.6px';
    else if (val === '16pt') editorWordPageContent.style.fontSize = '21.3px';
    btnEditorGost.classList.remove('gost-active');
  });
  
  selectEditorSpacing.addEventListener('change', (e) => {
    editorWordPageContent.style.lineHeight = e.target.value;
    btnEditorGost.classList.remove('gost-active');
  });
  
  selectEditorAlign.addEventListener('change', (e) => {
    editorWordPageContent.style.textAlign = e.target.value;
    btnEditorGost.classList.remove('gost-active');
  });
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function openFileInEditor(filePath) {
  try {
    const filename = filePath.split('/').pop() || filePath;
    editorTitle.textContent = filename;
    editorFilepath.textContent = filePath;
    
    editorWordPageContent.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding-top: 50px;">Загрузка файла...</div>';
    editorSidePanel.classList.add('open');
    
    const response = await fetch(PROXY_BASE + '/api/file/read?path=' + encodeURIComponent(filePath));
    if (response.ok) {
      const data = await response.json();
      const text = data.content || '';
      
      const paragraphs = text.split('\n');
      editorWordPageContent.innerHTML = paragraphs.map(p => {
        const cleaned = p.trim();
        return cleaned === '' ? '<p><br></p>' : `<p>${escapeHTML(p)}</p>`;
      }).join('');
      
      applyGostVisualStyles();
    } else {
      const err = await response.json();
      editorWordPageContent.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Ошибка при загрузке: ${err.error || 'Неизвестная ошибка'}</div>`;
    }
  } catch (err) {
    console.error(err);
    editorWordPageContent.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Не удалось прочитать файл.</div>`;
  }
}

function applyGostVisualStyles() {
  editorWordPage.style.padding = '2.0cm 1.5cm 2.0cm 3.0cm';
  editorWordPageContent.style.fontFamily = "'Times New Roman', Times, serif";
  editorWordPageContent.style.fontSize = '18.6px'; // ~14pt
  editorWordPageContent.style.lineHeight = '1.5';
  editorWordPageContent.style.textAlign = 'justify';
  
  const paras = editorWordPageContent.querySelectorAll('p');
  paras.forEach(p => {
    if (p.textContent.trim() !== '') {
      p.style.textIndent = '1.25cm';
    } else {
      p.style.textIndent = '0';
    }
    p.style.margin = '0';
    p.style.marginBottom = '0';
  });
  
  btnEditorGost.classList.add('gost-active');
  selectEditorFont.value = 'Times New Roman';
  selectEditorSize.value = '14pt';
  selectEditorSpacing.value = '1.5';
  selectEditorAlign.value = 'justify';
}

async function saveEditorFile() {
  const filePath = editorFilepath.textContent;
  if (!filePath) return;
  
  const filename = filePath.split('/').pop() || '';
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
  
  const paras = Array.from(editorWordPageContent.querySelectorAll('p'));
  const lines = paras.map(p => {
    if (p.innerHTML === '<br>' || p.textContent === '') return '';
    return p.textContent;
  });
  const content = lines.join('\n');
  
  try {
    const btnSave = document.getElementById('btnEditorSave');
    btnSave.disabled = true;
    btnSave.textContent = 'Сохранение...';
    
    const response = await fetch(PROXY_BASE + '/api/file/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: dirPath,
        filename: filename,
        content: content
      })
    });
    
    btnSave.disabled = false;
    btnSave.textContent = '💾 Сохранить';
    
    if (response.ok) {
      alert('Файл успешно сохранен!');
      connectFolder(folderPath);
    } else {
      const err = await response.json();
      alert('Ошибка при сохранении: ' + (err.error || 'Неизвестная ошибка'));
    }
  } catch (err) {
    console.error(err);
    const btnSave = document.getElementById('btnEditorSave');
    btnSave.disabled = false;
    btnSave.textContent = '💾 Сохранить';
    alert('Не удалось связаться с сервером для сохранения.');
  }
}

// Run!
window.onload = init;
