// DOM Elements
const noteForm = document.getElementById('note-form');
const noteInput = document.getElementById('note-input');
const notesList = document.getElementById('notes-list');
const statusEl = document.getElementById('status');

// Check online status
window.addEventListener('online', () => {
  statusEl.textContent = 'Online ✅';
  syncNotes(); // Sync when back online
});

window.addEventListener('offline', () => {
  statusEl.textContent = 'Offline 🔴';
});

// Load notes from IndexedDB
document.addEventListener('DOMContentLoaded', () => {
  if (!navigator.onLine) statusEl.textContent = 'Offline 🔴';
  loadNotes();
});

// Add a new note
noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const note = noteInput.value.trim();
  if (note) {
    addNoteToDB(note);
    noteInput.value = '';
  }
});

// IndexedDB setup
let db;
const request = indexedDB.open('NotesDB', 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
};

request.onsuccess = (e) => {
  db = e.target.result;
  loadNotes();
};

// Add note to IndexedDB
function addNoteToDB(note) {
  const transaction = db.transaction('notes', 'readwrite');
  const store = transaction.objectStore('notes');
  store.add({ text: note, timestamp: new Date().getTime() });
  loadNotes();
}

// Load notes from IndexedDB
function loadNotes() {
  const transaction = db.transaction('notes', 'readonly');
  const store = transaction.objectStore('notes');
  const request = store.getAll();

  request.onsuccess = () => {
    notesList.innerHTML = '';
    request.result.forEach(note => {
      const li = document.createElement('li');
      li.textContent = note.text;
      notesList.appendChild(li);
    });
  };
}

// Sync notes to a server (mock function)
function syncNotes() {
  console.log('Syncing notes to server...');
  // In a real app, you'd send data to a backend here.
}