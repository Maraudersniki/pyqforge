from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import json
import os
import time

# --- Configuration ---
PORT = 5001
# Set the static folder explicitly to manage assets (js/, views/)
FLASK_STATIC_FOLDER = os.path.join(os.getcwd(), 'static')

# Flask App Initialization
# **CRITICAL FIX:** Setting static_folder to the calculated path
app = Flask(__name__, static_folder=FLASK_STATIC_FOLDER) 

# Configuration for SQLite Database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Enable CORS for communication with the frontend (running on different port/address)
CORS(app, resources={r"/api/*": {"origins": f"http://127.0.0.1:{PORT}"}})
db = SQLAlchemy(app)

# --- Database Models ---
class QuestionPaper(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    upload_date = db.Column(db.String(10), nullable=False)
    total_questions = db.Column(db.Integer, default=0)
    total_marks = db.Column(db.Integer, default=0)
    # Fields for better categorization (Subject and Year)
    subject = db.Column(db.String(50))
    exam_year = db.Column(db.Integer)

    questions = db.relationship('Question', backref='paper', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'upload_date': self.upload_date,
            'total_questions': self.total_questions,
            'total_marks': self.total_marks,
            'subject': self.subject,
            'exam_year': self.exam_year
        }

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    paper_id = db.Column(db.Integer, db.ForeignKey('question_paper.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    marks = db.Column(db.Integer, default=0)
    answers = db.Column(db.Text, default="[]") 

    def to_dict(self):
        return {
            'id': self.id,
            'paper_id': self.paper_id,
            'text': self.text,
            'marks': self.marks,
            'answers': json.loads(self.answers)
        }

# --- Database Initialization Helper ---
def create_database_if_not_exists():
    if not os.path.exists('site.db'):
        with app.app_context():
            db.create_all()
            print("Database tables created successfully.")
    else:
        # Simple check to ensure new columns are registered
        with app.app_context():
            db.create_all()

# --- Custom Static File Serving ---
# This ensures Flask serves files from the 'static' folder correctly
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(FLASK_STATIC_FOLDER, filename)

# --- API Routes ---

# **CRITICAL FIX:** Serves index.html from the root directory when user navigates to the root address
@app.route('/')
def serve_index():
    # Look for index.html in the current working directory (where app.py is located)
    return send_from_directory(os.getcwd(), 'index.html')

@app.route('/api/upload', methods=['POST'])
def handle_upload():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    user_id = data.get('user_id')
    title = data.get('title')
    subject = data.get('subject', 'Unknown')
    exam_year = data.get('exam_year', 0)
    extracted_questions = data.get('questions', [])

    if not user_id or not title or not extracted_questions:
        return jsonify({'error': 'Missing required fields (user_id, title, or questions)'}), 400

    try:
        with app.app_context():
            # Create the QuestionPaper entry
            paper = QuestionPaper(
                user_id=user_id,
                title=title,
                subject=subject,
                exam_year=exam_year,
                upload_date=data.get('upload_date'),
                total_questions=len(extracted_questions),
                total_marks=data.get('total_marks', 0)
            )
            db.session.add(paper)
            db.session.commit()

            # Create and link all Question entries
            for q_data in extracted_questions:
                question = Question(
                    paper_id=paper.id,
                    text=q_data.get('question'),
                    marks=q_data.get('marks', 0)
                )
                db.session.add(question)
            
            db.session.commit()
            return jsonify({'message': f'Paper {paper.title} and {len(extracted_questions)} questions saved successfully!', 'paper_id': paper.id}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Database error during upload: {e}")
        return jsonify({'error': 'Internal server error during database save.'}), 500

@app.route('/api/papers/<user_id>', methods=['GET'])
def get_papers_by_user(user_id):
    try:
        with app.app_context():
            papers = QuestionPaper.query.filter_by(user_id=user_id).order_by(QuestionPaper.upload_date.desc()).all()
            return jsonify([paper.to_dict() for paper in papers]), 200
    except Exception as e:
        print(f"Database error fetching papers: {e}")
        return jsonify({'error': 'Internal server error fetching papers.'}), 500

@app.route('/api/questions/<paper_id>', methods=['GET'])
def get_questions_by_paper(paper_id):
    try:
        with app.app_context():
            questions = Question.query.filter_by(paper_id=paper_id).all()
            return jsonify([q.to_dict() for q in questions]), 200
    except Exception as e:
        print(f"Database error fetching questions: {e}")
        return jsonify({'error': 'Internal server error fetching questions.'}), 500

# --- Flask Server Startup ---
if __name__ == '__main__':
    create_database_if_not_exists()
    app.run(debug=True, port=PORT)
