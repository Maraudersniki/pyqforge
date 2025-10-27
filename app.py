from flask import Flask, render_template, redirect, url_for, request

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True)
