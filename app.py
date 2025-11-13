from flask import Flask, render_template, request, redirect, url_for,jsonify
from models import db, Flashcard,Question
import fitz  # PyMuPDF
import re
import os

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ✅ Database setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///pyqforge.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# ✅ Create tables automatically
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

# --- Signup route ---
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if len(password) < 8:
            return "❌ Password must be at least 8 characters long."

        # For now just redirect (no database yet)
        print(f"✅ New signup: {username}")
        return redirect(url_for('dashboard'))

    # optional: you can reuse same index.html signup section
    return render_template('index.html')


# --- Login route ---
@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    if len(password) < 8:
        return "❌ Password must be at least 8 characters long."

    print(f"✅ Login attempt: {username}")
    return redirect(url_for('dashboard'))

@app.route('/upload', methods=['GET', 'POST'])
def upload():
    if request.method == 'POST':
        file = request.files['file']
        if file and file.filename.endswith('.pdf'):
            filepath = os.path.join('uploads', file.filename)
            file.save(filepath)

            text = ""
            with fitz.open(filepath) as pdf:
                for page in pdf:
                    text += page.get_text()

            # Split by PART / UNIT / SECTION headers
            section_blocks = re.split(
                r'(?=\b(?:PART|UNIT|SECTION)[\s\-]*[IVXLC\dA-Z]+)',
                text,
                flags=re.IGNORECASE
            )

            all_questions = []

            for block in section_blocks:
                section_match = re.match(
                    r'(PART[\s\-]*[IVXLC\d]+|UNIT[\s\-]*[IVXLC\d]+|SECTION[\s\-]*[A-Z])',
                    block.strip(),
                    re.IGNORECASE
                )
                section_name = section_match.group(1).strip() if section_match else "General"

                # Capture entire question lines like: Q1..., a)..., b)..., etc.
                questions = re.findall(
                    r'((?:Q\d+[\.\)]?|[a-zA-Z][\.\)])\s+.*?(?=(?:Q\d+[\.\)]?|[a-zA-Z][\.\)]|$)))',
                    block,
                    flags=re.DOTALL
                )

                for q in questions:
                    q_clean = re.sub(r'\s+', ' ', q).strip()
                    if len(q_clean) > 5:
                        all_questions.append((section_name, q_clean))

            print(f"✅ Extracted {len(all_questions)} questions")

            # Save to DB
            for section, q_text in all_questions:
                new_q = Question(text=q_text, section=section)
                db.session.add(new_q)

            db.session.commit()
            return jsonify({"message": f"✅ Saved {len(all_questions)} questions to database!"})

    return render_template('upload.html')


 
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/banks')
def banks():
    questions = Question.query.all()

    # Convert to JSON-like structure grouped by section
    banks_data = {
        "id": 1,
        "title": "Uploaded Question Bank",
        "questions": [
            {"id": q.id, "section": q.section or "N/A", "question": q.text, "has_answer": False}
            for q in questions
        ]
    }

    return render_template('banks.html', banks_data=banks_data)


@app.route('/flashcards', methods=['GET', 'POST'])
def flashcards():
    if request.method == 'POST':
        question = request.form['question']
        answer = request.form['answer']
        new_card = Flashcard(question=question, answer=answer)
        db.session.add(new_card)
        db.session.commit()
        return redirect(url_for('flashcards'))
    
    cards = Flashcard.query.all()
    return render_template('flashcards.html', cards=cards)

@app.route('/delete_null')
def delete_null():
    import sqlite3
    conn = sqlite3.connect('pyqforge.db')
    cursor = conn.cursor()

    # adjust column names based on your table
    cursor.execute("""
        DELETE FROM Question
        WHERE section IS NULL
        OR section = ''
    """)

    conn.commit()
    conn.close()
    return "Deleted all null or empty rows!"

if __name__ == '__main__':
    app.run(debug=True)
