let selectedModel = 'gpt-4o';
let cropper;
let motivationIntervalId;
const dbName = 'HealthChatDB';
const storeName = 'unsentMessages';
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Set device-based class
document.body.classList.add(isMobile ? 'mobile' : 'desktop');

function getApiKey() {
  return localStorage.getItem('openai_api_key') || null;
}

function changeApiKey() {
  const input = prompt("🔁 Enter new OpenAI API key:");
  if (input) {
    localStorage.setItem('openai_api_key', input.trim());
    alert('✅ API key updated!');
  }
}

async function sendToOpenAI(userInput) {
  const apiKey = getApiKey();
  if (!apiKey) {
    appendMessage("⚠️ Please set your API key in Settings to chat.", 'bot');
    return;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: 'You are a health coach.' },
          { role: 'user', content: userInput }
        ]
      })
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    appendMessage(data.choices?.[0]?.message?.content || '🤖 No response.', 'bot');
  } catch (error) {
    console.error(error);
    appendMessage("❌ Error contacting OpenAI.", 'bot');
  }
}

function appendMessage(msg, sender) {
  const container = document.getElementById('chatContainer');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = sender;
  bubble.textContent = msg;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  let log = [];
  try {
    log = JSON.parse(localStorage.getItem('chatLog') || '[]');
  } catch {
    localStorage.removeItem('chatLog');
  }
  log.push({ msg, sender, timestamp: new Date().toISOString() });
  localStorage.setItem('chatLog', JSON.stringify(log));
}

async function sendMessage(msg) {
  appendMessage(msg, 'user');
  if (navigator.onLine) {
    try {
      await sendToOpenAI(msg);
    } catch {
      await storeUnsentMessage({ msg, sender: 'user', timestamp: new Date().toISOString() });
    }
  } else {
    await storeUnsentMessage({ msg, sender: 'user', timestamp: new Date().toISOString() });
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = e => {
      e.target.result.createObjectStore(storeName, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('❌ IndexedDB error');
  });
}

async function storeUnsentMessage(message) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).add(message);
  } catch (err) {
    console.error("IndexedDB Store Error:", err);
  }
}

async function syncMessages() {
  if (!navigator.onLine) return;

  try {
    const db = await openDatabase();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const all = store.getAll();

    all.onsuccess = async () => {
      for (const msg of all.result) {
        try {
          await sendToOpenAI(msg.msg);
        } catch {
          break;
        }
      }
      store.clear();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("📶 Offline messages synced!");
      }
    };
  } catch (err) {
    console.error("Sync Error:", err);
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');

  document.querySelectorAll('nav div').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function saveMotivationSettings() {
  const mins = document.getElementById('motivationInterval').value;
  const ms = parseInt(mins) * 60000;
  localStorage.setItem('motivationInterval', ms);
  alert('✅ Reminder set!');
}

function scheduleMotivation() {
  if (!("Notification" in window)) return;
  if (motivationIntervalId) clearInterval(motivationIntervalId);

  const interval = parseInt(localStorage.getItem('motivationInterval') || '3600000');
  if (Notification.permission !== 'granted') Notification.requestPermission();

  motivationIntervalId = setInterval(() => {
    if (Notification.permission === 'granted') {
      const messages = [
        "💪 You're doing great!",
        "🚶 Time for a quick walk!",
        "🥗 Healthy food check!",
        "💧 Stay hydrated!"
      ];
      new Notification(messages[Math.floor(Math.random() * messages.length)]);
    }
  }, interval);
}

function toggleModel() {
  selectedModel = selectedModel === 'gpt-4o' ? 'gpt-3.5-turbo' : 'gpt-4o';
  alert('Model switched to ' + selectedModel);
}

function applyThemeFromImage(img) {
  const colorThief = new ColorThief();
  if (img.complete) {
    const [r, g, b] = colorThief.getColor(img);
    document.documentElement.style.setProperty('--theme-color', `rgb(${r}, ${g}, ${b})`);
  } else {
    img.onload = () => {
      const [r, g, b] = colorThief.getColor(img);
      document.documentElement.style.setProperty('--theme-color', `rgb(${r}, ${g}, ${b})`);
    };
  }
}

window.onload = () => {
  const saved = localStorage.getItem('customWallpaper');
  if (saved) {
    document.body.style.backgroundImage = `url(${saved})`;
    const img = new Image();
    img.src = saved;
    applyThemeFromImage(img);
  }

  let logs = [];
  try {
    logs = JSON.parse(localStorage.getItem('chatLog') || '[]');
  } catch {
    localStorage.removeItem('chatLog');
  }
  logs.forEach(entry => appendMessage(entry.msg, entry.sender));

  scheduleMotivation();
  syncMessages();

  const summaryBtn = document.getElementById('summaryBtn');
  const sendBtn = document.getElementById('sendBtn');
  const wallpaperInput = document.getElementById('wallpaperInput');
  const applyWallpaperBtn = document.getElementById('applyWallpaperBtn');
  const cancelWallpaperBtn = document.getElementById('cancelWallpaperBtn');
  const navTabs = document.querySelectorAll('nav div');

  summaryBtn?.addEventListener('click', async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      appendMessage("⚠️ Set your API key in Settings to use summary.", 'bot');
      return;
    }

    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem('chatLog') || '[]');
    } catch {}
    const summary = logs.map(entry => `[${entry.sender}] ${entry.msg}`).join('\n');
    appendMessage("📊 Generating summary...", 'bot');

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: 'Summarize this health log and give motivation.' },
            { role: 'user', content: summary }
          ]
        })
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      appendMessage(data.choices?.[0]?.message?.content || '📝 No summary available.', 'bot');
    } catch (err) {
      console.error(err);
      appendMessage('❌ Failed to generate summary.', 'bot');
    }
  });

  sendBtn?.addEventListener('click', () => {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (text) {
      sendMessage(text);
      input.value = '';
    }
  });

  if (wallpaperInput) {
    wallpaperInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const preview = document.getElementById('wallpaperPreview');
        if (!preview) return;
        preview.src = reader.result;

        preview.onload = () => {
          document.getElementById('wallpaperCropperContainer')?.classList.add('show');

          if (cropper) {
            try { cropper.destroy(); } catch {}
            cropper = null;
          }

          setTimeout(() => {
            try {
              cropper = new Cropper(preview, {
                aspectRatio: isMobile ? 1 : 16 / 9,
                viewMode: 1,
                autoCropArea: 1,
                dragMode: 'move',
                guides: true,
                highlight: true,
                cropBoxResizable: true,
                cropBoxMovable: true,
                responsive: true
              });
            } catch (err) {
              console.error("Cropper error:", err);
            }
          }, 100);
        };
      };
      reader.readAsDataURL(file);
    });
  }

  if (applyWallpaperBtn) {
    applyWallpaperBtn.addEventListener('click', () => {
      const preview = document.getElementById('wallpaperPreview');
      if (!preview || !preview.src || !cropper || typeof cropper.getCroppedCanvas !== 'function') {
        alert('⚠️ Please select and crop an image first.');
        return;
      }

      try {
        const canvas = cropper.getCroppedCanvas({ width: 1280, height: 720 });
        if (!canvas) throw new Error('Canvas not created');
        const dataURL = canvas.toDataURL('image/jpeg', 0.6);

        document.body.style.backgroundImage = `url(${dataURL})`;
        localStorage.setItem('customWallpaper', dataURL);

        const img = new Image();
        img.src = dataURL;
        applyThemeFromImage(img);

        document.getElementById('wallpaperCropperContainer')?.classList.remove('show');
        cropper.destroy();
        cropper = null;
        preview.src = '';
      } catch (err) {
        console.error("Wallpaper apply error:", err);
        alert('❌ Failed to apply wallpaper. Please try again.');
      }
    });
  }

  if (cancelWallpaperBtn) {
    cancelWallpaperBtn.addEventListener('click', () => {
      document.getElementById('wallpaperCropperContainer')?.classList.remove('show');
      const preview = document.getElementById('wallpaperPreview');
      if (cropper) {
        try { cropper.destroy(); } catch {}
        cropper = null;
      }
      preview.src = '';
    });
  }

  navTabs?.forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  document.addEventListener('keydown', (e) => {
    const tabs = ['chat', 'dashboard', 'settings'];
    const active = tabs.findIndex(t => document.getElementById(t).classList.contains('active'));
    if (e.key === 'ArrowRight') switchTab(tabs[(active + 1) % tabs.length]);
    if (e.key === 'ArrowLeft') switchTab(tabs[(active + 2) % tabs.length]);
  });
};
