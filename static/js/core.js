// Global State and Configuration
export const PORT = 5001;
export const FLASK_API_URL = `http://127.0.0.1:${PORT}`;

// Gemini API Configuration (Leave as empty string for this environment)
export const apiKey = "";
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";

// Application State
export let userId = null; // Changed to 'let' so it can be updated
export let currentView = 'landing';
export let allPapers = []; // Stores the list of QuestionPaper objects
export let currentPaperId = null;
export let currentQuestions = []; // Stores the questions for the current paper
export let currentQuestionIndex = 0;

// View Names - Must match IDs in index.html and view files
export const VIEW_NAMES = {
    LANDING: 'landing-view',
    DASHBOARD: 'dashboard-view',
    UPLOAD: 'upload-view',
    BANKS: 'banks-view',
    PRACTICE: 'practice-view',
    STATISTICS: 'statistics-view',
    STUDY: 'study-tools-view',
};

// --- Setter Function for Global State (CRITICAL FIX) ---
// This function is attached to the window object to update the global userId
export function setGlobalUserId(newId) {
    userId = newId;
}

// --- Helper Functions ---

/** Converts a File object to a Base64 string for the Gemini API. */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/** Displays application-wide notifications. */
export function showNotification(message, type = 'success') {
    const notificationContainer = document.getElementById('notification-container');
    const notification = document.createElement('div');
    
    let baseClasses = "fixed top-4 right-4 p-4 rounded-lg shadow-xl z-50 text-sm font-semibold transition-transform duration-300 transform translate-y-0";
    if (type === 'success') {
        notification.className = baseClasses + " bg-green-500 text-white";
    } else {
        notification.className = baseClasses + " bg-red-500 text-white";
    }

    notification.textContent = message;
    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('translate-y-full'); // Start slide out
        notification.classList.remove('translate-y-0');
        setTimeout(() => notification.remove(), 400); // Remove after animation
    }, 4000);
}

// Initialization function called when index.html loads
document.addEventListener('DOMContentLoaded', () => {
    // loadViewContent is defined in ui.js and runs the full UI setup
    if (typeof loadViewContent === 'function') {
        loadViewContent();
    }
});