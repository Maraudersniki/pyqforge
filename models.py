from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(255), nullable=False)
    answer = db.Column(db.Text, nullable=False)

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    section = db.Column(db.String(200))
    text = db.Column(db.Text)
