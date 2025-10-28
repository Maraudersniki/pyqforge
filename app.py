from flask import Flask, render_template, request, redirect, url_for
from models import db, Flashcard

app = Flask(__name__)

# ✅ Database setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///examforge.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# ✅ Create tables automatically
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload')
def upload():
    return render_template('upload.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/banks')
def banks():
    return render_template('banks.html')

@app.route('/login', methods=['POST'])
def login():
    # You can check username/password later
    username = request.form.get('username')
    password = request.form.get('password')
    return redirect(url_for('dashboard'))

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

if __name__ == '__main__':
    app.run(debug=True)
