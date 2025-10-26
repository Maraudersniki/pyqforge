// Import required functions and variables from core.js and api.js
import { showNotification, userId, allPapers, VIEW_NAMES } from './core.js';
import { loadPapers } from './api.js';

// --- Global Registration Fix ---
// Register the function globally so the HTML onclick="window.setUserIdFromLanding()" can find it immediately
window.setUserIdFromLanding = function() {
    setUserIdFromLanding(); // Calls the internal function below
};

/** Helper to update the navigation bar and view visibility */
export function updateNavigation(activeView) {
    document.querySelectorAll('.nav-button').forEach(btn => {
        if (btn.dataset.view === activeView) {
            btn.classList.add('bg-indigo-700', 'text-white');
            btn.classList.remove('hover:bg-indigo-600', 'text-indigo-200');
        } else {
            btn.classList.remove('bg-indigo-700', 'text-white');
            btn.classList.add('hover:bg-indigo-600', 'text-indigo-200');
        }
    });

    // Hide all view containers and show only the active one
    Object.values(VIEW_NAMES).forEach(viewId => {
        const viewElement = document.getElementById(viewId);
        if (viewElement) {
            if (viewId === activeView) {
                viewElement.classList.remove('hidden');
            } else {
                viewElement.classList.add('hidden');
            }
        }
    });
}

/** Main function to switch between views */
export function switchView(viewName) {
    if (!userId && viewName !== VIEW_NAMES.LANDING) {
        showNotification("Please use the Landing Page to set your User ID first.", 'error');
        return;
    }

    // After setting the user ID, show the header
    if (viewName !== VIEW_NAMES.LANDING) {
        document.getElementById('main-header').classList.remove('hidden');
    }

    updateNavigation(viewName);
    
    // Specific actions for certain views
    if (viewName === VIEW_NAMES.BANKS || viewName === VIEW_NAMES.DASHBOARD) {
        loadPapers(); // Defined in api.js
    }
    
    // Scroll to top when switching views for better UX
    window.scrollTo(0, 0);
}

/** Renders the list of papers in the 'My Question Banks' view */
export function renderPapersList(papers) {
    const listElement = document.getElementById('papers-list');
    
    if (!listElement) return;

    if (papers.length === 0) {
        listElement.innerHTML = `<p class="text-center text-gray-500 py-8">No question papers found. Upload one to get started!</p>`;
        return;
    }

    listElement.innerHTML = ''; // Clear existing list

    papers.forEach(paper => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300 flex flex-col";
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-xl font-bold text-gray-900">${paper.title}</h3>
                    <p class="text-sm text-indigo-600 font-medium">${paper.subject} (${paper.exam_year})</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-semibold text-gray-700">${paper.total_questions} Qs</p>
                    <p class="text-xs text-gray-500">${paper.total_marks} Marks</p>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <p class="text-xs text-gray-400">Uploaded: ${paper.upload_date}</p>
                <button onclick="startPracticeMode(${paper.id})" 
                        class="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition duration-150 shadow-md">
                    Start Practice
                </button>
            </div>
        `;
        listElement.appendChild(card);
    });
}

/** Updates the Dashboard summary statistics */
export function updateDashboard(papers) {
    // Ensure this function is called after papers are loaded
    if (!papers) papers = allPapers;

    const totalPapers = papers.length;
    const totalQuestions = papers.reduce((sum, p) => sum + p.total_questions, 0);
    const totalMarks = papers.reduce((sum, p) => sum + p.total_marks, 0);

    const uniqueSubjects = new Set(papers.map(p => p.subject)).size;

    // Safely update DOM elements
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    updateText('stat-papers', totalPapers);
    updateText('stat-questions', totalQuestions);
    updateText('stat-subjects', uniqueSubjects);
    updateText('stat-marks', totalMarks);
}

/** Placeholder for the Practice Session (Planned for next sprint) */
export function startPracticeMode(paperId) {
    // Actual implementation would switch view and load questions from Flask API
    showNotification(`Practice Mode is loading for Paper ID: ${paperId}. Feature coming soon!`, 'info');
    // currentPaperId = paperId;
    // getQuestionsByPaper(paperId); // Defined in api.js
    // switchView(VIEW_NAMES.PRACTICE);
}

/** Handles setting the User ID from the Landing Page */
function setUserIdFromLanding() {
    // Generate a simple unique ID for this session
    const randomId = 'Guest-' + Math.random().toString(36).substring(2, 8);
    
    // Set the User ID in core.js (assuming a setter function or direct mutation if possible)
    window.setGlobalUserId(randomId); 
    
    const displayElement = document.getElementById('user-id-display');
    if(displayElement) displayElement.textContent = `User ID: ${randomId}`;
    
    showNotification(`User ID set to ${randomId}. Welcome!`);
    switchView(VIEW_NAMES.DASHBOARD); // Move to the main app dashboard
}


// --- Dynamic HTML Loading ---

// CRITICAL FIX: Explicitly set paths relative to the Flask static route
const viewMap = {
    [VIEW_NAMES.LANDING]: 'landing', // Special case: template is in index.html
    [VIEW_NAMES.DASHBOARD]: '/static/views/dashboard.html',
    [VIEW_NAMES.UPLOAD]: '/static/views/upload.html',
    [VIEW_NAMES.BANKS]: '/static/views/banks.html',
    [VIEW_NAMES.PRACTICE]: '/static/views/practice.html',
    [VIEW_NAMES.STATISTICS]: '/static/views/statistics.html',
    [VIEW_NAMES.STUDY]: '/static/views/study-tools.html',
};

// Fetches the separate HTML view files and injects them into the main index.html
export async function loadViewContent() {
    const container = document.getElementById('views-container');
    if (!container) return;

    // List of view files to fetch (excluding the special landing page)
    const filesToFetch = Object.entries(viewMap).filter(([key, path]) => key !== VIEW_NAMES.LANDING);

    // --- Loading Indicator ---
    container.innerHTML = `<p class="text-indigo-500 flex items-center justify-center py-10"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Loading application views...</p>`;

    try {
        let allViewsHTML = '';
        const cacheBuster = `?v=${Date.now()}`; // Ensures no old file is cached
        
        for (const [viewId, filePath] of filesToFetch) {
            
            const fullPath = filePath + cacheBuster;
            
            const response = await fetch(fullPath);

            if (!response.ok) {
                // If file not found (e.g., 404), throw a specific error
                throw new Error(`Failed to fetch view file: ${filePath} (Status: ${response.status})`);
            }

            const htmlContent = await response.text();
            
            // Wrap the content in the required view container div
            allViewsHTML += `<div id="${viewId}" class="view-content hidden">${htmlContent}</div>`;
        }
        
        // Remove the loading indicator and inject all HTML content
        container.innerHTML = allViewsHTML;
        
        // Final step: switch to the landing page which is already in index.html
        switchView(VIEW_NAMES.LANDING);
    } catch (error) {
        console.error("CRITICAL ERROR: Failed to load application views. Ensure Flask server is running and the 'static/views/' folder exists.", error);
        container.innerHTML = `<p class="text-red-600 text-center py-10">CRITICAL ERROR: Failed to load views. Ensure 'static/views/' folder and all files inside exist and Flask is running.</p>`;
    }
}