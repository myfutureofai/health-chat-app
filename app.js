let selectedModel = 'gpt-4o';
let cropper;
let motivationIntervalId;
const dbName = 'HealthChatDB';
const storeName = 'unsentMessages';

function getApiKey() {
  return localStorage.getItem('openai_api_key') || null;
}

function changeApiKey() {
  const input = prompt("🔐 Enter your OpenAI API key:");
  if (input) {
    localStorage.setItem('openai_api_key', input.trim());
    alert('✅ API key updated!');
  }
}

async function sendToOpenAI(userInput) {
  const apiKey = getApiKey();
  if (!apiKey) return appendMessage("⚠️ Please set your API key in Settings.", 'bot');

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
          { role: 'system', content: 'You are a helpful health assistant.' },
          { role: 'user', content: userInput }
        ]
      })
    });

    const data = await res.json();
    appendMessage(data.choices?.[0]?.message?.content || '🤖 No response.', 'bot');
  } catch (err) {
    console.error(err);
    appendMessage('❌ Failed to reach OpenAI.', 'bot');
  }
}

function appendMessage(msg, sender) {
  const container = document.getElementById('chatContainer');
  const bubble = document.createElement('div');
  bubble.className = `bubble ${sender}`;
  bubble.innerHTML = msg.replace(/\n/g, '<br>'); // support newlines

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  // Save log
  const log = JSON.parse(localStorage.getItem('chatLog') || '[]');
  log.push({ msg, sender, timestamp: new Date().toISOString() });
  localStorage.setItem('chatLog', JSON.stringify(log));
}

async function sendMessage(msg) {
  appendMessage(msg, 'user');
  if (navigator.onLine) {
    await sendToOpenAI(msg);
  } else {
    await storeUnsentMessage({ msg, sender: 'user', timestamp: new Date().toISOString() });
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');

  document.querySelectorAll('nav div').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = e => {
      e.target.result.createObjectStore(storeName, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject();
  });
}

async function storeUnsentMessage(message) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).add(message);
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
        await sendToOpenAI(msg.msg);
      }
      store.clear();
    };
  } catch (err) {
    console.error('Sync failed', err);
  }
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
        "🚶‍♂️ Time to move!",
        "🥦 Eat something healthy!",
        "💧 Drink water!"
      ];
      new Notification(messages[Math.floor(Math.random() * messages.length)]);
    }
  }, interval);
}

function saveMotivationSettings() {
  const val = document.getElementById('motivationInterval').value;
  localStorage.setItem('motivationInterval', parseInt(val) * 60000);
  alert("✅ Motivation timer set!");
}

function toggleModel() {
  selectedModel = selectedModel === 'gpt-4o' ? 'gpt-3.5-turbo' : 'gpt-4o';
  alert("Model switched to " + selectedModel);
}

function applyThemeFromImage(img) {
  const colorThief = new ColorThief();
  if (img.complete) {
    const [r, g, b] = colorThief.getColor(img);
    document.documentElement.style.setProperty('--theme-color', `rgb(${r},${g},${b})`);
  } else {
    img.onload = () => {
      const [r, g, b] = colorThief.getColor(img);
      document.documentElement.style.setProperty('--theme-color', `rgb(${r},${g},${b})`);
    };
  }
}

window.onload = () => {
  const wallpaper = localStorage.getItem('customWallpaper');
  if (wallpaper) {
    document.body.style.backgroundImage = `url(${wallpaper})`;
    const img = new Image();
    img.src = wallpaper;
    applyThemeFromImage(img);
  }

  const logs = JSON.parse(localStorage.getItem('chatLog') || '[]');
  logs.forEach(entry => appendMessage(entry.msg, entry.sender));

  scheduleMotivation();
  syncMessages();

  document.getElementById('sendBtn')?.addEventListener('click', () => {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (text) {
      sendMessage(text);
      input.value = '';
    }
  });

  document.getElementById('summaryBtn')?.addEventListener('click', async () => {
    const apiKey = getApiKey();
    if (!apiKey) return appendMessage("⚠️ Set your API key in Settings.", 'bot');

    const logs = JSON.parse(localStorage.getItem('chatLog') || '[]');
    const summary = logs.map(e => `[${e.sender}] ${e.msg}`).join('\n');
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

      const data = await res.json();
      appendMessage(data.choices?.[0]?.message?.content || '📄 No summary available.', 'bot');
    } catch (err) {
      console.error(err);
      appendMessage("❌ Failed to generate summary.", 'bot');
    }
  });

  // Wallpaper upload logic
  const wallpaperInput = document.getElementById('wallpaperInput');
  const applyBtn = document.getElementById('applyWallpaperBtn');
  const cancelBtn = document.getElementById('cancelWallpaperBtn');

  wallpaperInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const preview = document.getElementById('wallpaperPreview');
      preview.src = reader.result;
      preview.onload = () => {
        document.getElementById('wallpaperCropperContainer')?.classList.add('show');
        if (cropper) cropper.destroy();
        cropper = new Cropper(preview, {
          aspectRatio: 16 / 9,
          viewMode: 1,
          autoCropArea: 1,
        });
      };
    };
    reader.readAsDataURL(file);
  });

  applyBtn?.addEventListener('click', () => {
    if (!cropper) return alert("⚠️ Please select and crop an image.");
    const canvas = cropper.getCroppedCanvas({ width: 1280, height: 720 });
    const dataURL = canvas.toDataURL('image/jpeg', 0.6);
    document.body.style.backgroundImage = `url(${dataURL})`;
    localStorage.setItem('customWallpaper', dataURL);

    const img = new Image();
    img.src = dataURL;
    applyThemeFromImage(img);

    document.getElementById('wallpaperCropperContainer')?.classList.remove('show');
    cropper.destroy();
    cropper = null;
  });

  cancelBtn?.addEventListener('click', () => {
    document.getElementById('wallpaperCropperContainer')?.classList.remove('show');
    if (cropper) cropper.destroy();
    cropper = null;
    document.getElementById('wallpaperPreview').src = '';
  });

  document.querySelectorAll('nav div').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
};
