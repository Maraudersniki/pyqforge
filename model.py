from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    section = db.Column(db.String(100))
    question_no = db.Column(db.String(50))
    question_text = db.Column(db.Text)
    marks = db.Column(db.String(10))
    answer_text = db.Column(db.Text)
    answer_image = db.Column(db.String(300))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
