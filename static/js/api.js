// Import required functions and variables from core.js and ui.js
import { showNotification, userId, FLASK_API_URL, GEMINI_API_URL, apiKey, allPapers, VIEW_NAMES, PORT, fileToBase64 } from './core.js';
import { renderPapersList, updateDashboard, switchView } from './ui.js';

/** Calls the Gemini API to extract questions from a base64 file. */
async function callGeminiExtraction(base64Data, mimeType) {
    const systemPrompt = "You are a specialized question extraction AI. Analyze the provided PDF file data. Your task is to extract the **Subject** and **Exam Year** from the document, and then extract all distinct questions and their associated marks (if present). Respond ONLY with a clean JSON object structure. DO NOT INCLUDE ANY INTRODUCTORY OR EXPLANATORY TEXT. The structure must strictly be an OBJECT with 'subject', 'exam_year', and an array of 'questions'. Be precise and concise.";
    
    const payload = {
        contents: [
            { role: "user", parts: [ 
                { text: "Extract questions, subject, and year from this past paper. Only process PDF files." },
                { inlineData: { mimeType: mimeType, data: base64Data } }
            ]}
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "subject": { "type": "STRING" },
                    "exam_year": { "type": "INTEGER" },
                    "questions": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "question": { "type": "STRING" },
                                "marks": { "type": "INTEGER" }
                            },
                            "required": ["question", "marks"]
                        }
                    }
                },
                required: ["subject", "exam_year", "questions"]
            }
        }
    };

    try {
        const apiUrl = GEMINI_API_URL + apiKey;
        
        // --- 1. Retry Logic for API Call ---
        let response;
        for (let i = 0; i < 3; i++) {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) break;
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retrying
        }
        
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API failed after retries. Status: ${response.status}. Body: ${errorBody.substring(0, 100)}...`);
        }

        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
            throw new Error("AI did not return a valid content block.");
        }
        
        // Clean up markdown fences (```json...```)
        let cleanedJsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        // **CRITICAL FIX: Robust JSON Parsing**
        try {
            return JSON.parse(cleanedJsonText);
        } catch (parseError) {
            console.error("JSON PARSING FAILURE. Raw AI Output:", cleanedJsonText);
            throw new Error(`AI returned malformed data. Extraction failed. Raw response: ${cleanedJsonText.substring(0, 50)}...`);
        }

    } catch (error) {
        throw new Error(`Gemini Extraction failed. Details: ${error.message}`);
    }
}
export { callGeminiExtraction };

/** Main function to handle file upload, AI extraction, and saving to Flask. */
export async function handleFileUpload() {
    if (!userId) {
        showNotification('User ID not set. Please "Try Without Login" first.', 'error');
        return;
    }

    const title = document.getElementById('paper-title').value.trim();
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    const uploadButton = document.getElementById('upload-button');

    if (!title || !file) {
        showNotification('Please provide a title and select a PDF file.', 'error');
        return;
    }
    
    if (file.type !== 'application/pdf') {
        showNotification('Only PDF files are accepted for extraction.', 'error');
        return;
    }

    const statusElement = document.getElementById('upload-status');
    
    // --- UI State: Uploading ---
    uploadButton.disabled = true;
    uploadButton.innerHTML = `<span class="spinner"></span> Uploading...`;
    statusElement.classList.remove('hidden');
    statusElement.textContent = `1/3: Converting file...`;
    
    try {
        // 1. Convert file to Base64 (needed for API payload)
        const base64Data = await fileToBase64(file); // From core.js
        statusElement.textContent = `2/3: Extracting with AI... (This may take 15-30 seconds)`;

        // 2. Call Gemini API for extraction
        const aiData = await callGeminiExtraction(base64Data, file.type);
        const extractedQuestions = aiData.questions;
        
        if (!extractedQuestions || extractedQuestions.length === 0) {
            showNotification('AI extracted 0 questions. Please try a clearer PDF file.', 'error');
            return;
        }

        // 3. Prepare data for Flask
        const totalMarks = extractedQuestions.reduce((sum, q) => sum + q.marks, 0);
        const paperData = {
            title: title,
            user_id: userId,
            subject: aiData.subject,
            exam_year: aiData.exam_year,
            upload_date: new Date().toISOString().split('T')[0],
            total_questions: extractedQuestions.length,
            total_marks: totalMarks,
            questions: extractedQuestions
        };

        statusElement.textContent = `3/3: Sending to Flask server...`;

        // 4. Send structured data to Flask API for saving
        const flaskResponse = await fetch(`${FLASK_API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paperData)
        });

        if (flaskResponse.ok) {
            // const responseData = await flaskResponse.json(); // Not needed right now
            showNotification(`File processed! Subject: ${aiData.subject}, Year: ${aiData.exam_year}. Found ${extractedQuestions.length} questions.`);
            
            // Clear form and reload paper list
            document.getElementById('paper-title').value = '';
            fileInput.value = '';
            loadPapers(); // Triggers reload
            switchView(VIEW_NAMES.BANKS); // Move to banks view

        } else {
            const errorText = await flaskResponse.text();
            throw new Error(`Flask Server Error: ${flaskResponse.status} - ${errorText}`);
        }
        
    } catch (error) {
        console.error("Full Upload/Extraction Error:", error);
        showNotification(`Upload failed: ${error.message}. Check console for network or API errors.`, 'error');
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = `🧠 Upload & Process with AI`;
        statusElement.classList.add('hidden');
        statusElement.textContent = '';
    }
}


/** Fetches all papers from the Flask backend for the current user. */
export async function loadPapers() {
    if (!userId) return;

    const listElement = document.getElementById('papers-list');
    
    if (listElement) {
        listElement.innerHTML = `<p class="text-indigo-500 flex items-center justify-center py-8"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Fetching data from your Flask server...</p>`;
    }

    try {
        const response = await fetch(`${FLASK_API_URL}/api/papers/${userId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch papers: ${response.status}`);
        }
        
        // This is safe because we know the Flask endpoint returns clean JSON list
        allPapers = await response.json(); 
        renderPapersList(allPapers); // Function from ui.js
        updateDashboard(allPapers); // Function from ui.js

    } catch (error) {
        console.error("Error loading papers:", error);
        if (listElement) {
            listElement.innerHTML = `<p class="text-red-600 text-center py-8">Failed to connect to Flask Server. Ensure it is running on port ${PORT}.</p>`;
        }
    }
}


/** Fetches all questions for a specific paper from the Flask backend. */
export async function getQuestionsByPaper(paperId) {
    showNotification(`Loading questions for Paper ID ${paperId}...`, 'info');
    try {
        const response = await fetch(`${FLASK_API_URL}/api/questions/${paperId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch questions: ${response.status}`);
        }
        
        currentQuestions = await response.json();
        currentPaperId = paperId;
        currentQuestionIndex = 0;
        
        // Placeholder for practice mode start
        // renderPracticeQuestion(currentQuestions[currentQuestionIndex]); // Function from ui.js
        switchView(VIEW_NAMES.PRACTICE);

    } catch (error) {
        console.error("Error loading questions:", error);
        showNotification(`Could not load questions: ${error.message}`, 'error');
    }
}