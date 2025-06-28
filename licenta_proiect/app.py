from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import serial
import threading
import time
import os

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'evenimente.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

ser = None
semafor_activ = 1  # Semaforul curent simulat de Arduino

try:
    print("🔌 Conectare la COM5...")
    ser = serial.Serial('COM7', 9600, timeout=1)
    time.sleep(2)
    print("✅ Conectat la COM5")
except Exception as e:
    print("❌ Eroare conexiune serial:", e)

class Eveniment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tip = db.Column(db.String(80), nullable=False)
    semafor = db.Column(db.Integer, nullable=True)
    temperatura = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

def salveaza_eveniment(tip, semafor=None, temperatura=None):
    ev = Eveniment(tip=tip, semafor=semafor, temperatura=temperatura)
    with app.app_context():
        db.session.add(ev)
        db.session.commit()

def citire_serial():
    if not ser:
        print("⚠️ Serial inactiv.")
        return
    print("🧵 Thread Serial pornit.")
    while True:
        try:
            linie = ser.readline().decode().strip()
            if linie:
                print("📥 Arduino:", linie)
                if linie.startswith("PIETON_APASAT_S"):
                    semafor_id = int(linie.split("_S")[1])
                    salveaza_eveniment("Buton pieton", semafor_id)
                elif linie.startswith("TEMP:"):
                    temperatura = float(linie.split(":")[1])
                    salveaza_eveniment("Temperatura", temperatura=temperatura)
        except Exception as e:
            print("❌ Eroare citire serial:", e)
        time.sleep(0.1)

if ser:
    threading.Thread(target=citire_serial, daemon=True).start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/eveniment', methods=['POST'])
def api_eveniment():
    data = request.get_json()
    salveaza_eveniment(data.get("tip"), data.get("semafor"), data.get("temperatura"))
    return jsonify({'status': 'ok'})

@app.route('/api/evenimente')
def api_evenimente():
    evenimente = Eveniment.query.order_by(Eveniment.timestamp.desc()).limit(50).all()
    return jsonify([{
        'tip': e.tip,
        'semafor': e.semafor,
        'temperatura': e.temperatura,
        'timestamp': e.timestamp.strftime("%Y-%m-%d %H:%M:%S")
    } for e in evenimente])

@app.route('/api/select/<int:id>', methods=['POST'])
def select(id):
    global semafor_activ
    semafor_activ = id

    data = request.get_json()
    stare = data.get("stare", "ROSU")
    timp = data.get("timp", 60)
    pornit = data.get("pornit", True)
    noapte = data.get("noapte", False)

    if ser:
        try:
            ser.write(f"select {id} {stare} {timp}\n".encode())
            time.sleep(0.05)
            if not pornit:
                ser.write("opreste\n".encode())
            elif noapte:
                ser.write("toggle_noapte\n".encode())
        except Exception as e:
            print("❌ Eroare la SELECT:", e)

    salveaza_eveniment("Selectare semafor", id)
    return jsonify({'status': 'ok'})

@app.route('/api/opreste/<int:id>', methods=['POST'])
def opreste(id):
    global semafor_activ
    if id != semafor_activ:
        return jsonify({'status': 'ignored'})
    if ser:
        try:
            ser.write("opreste\n".encode())
            salveaza_eveniment("Oprire semafor", id)
        except Exception as e:
            print("❌ Eroare oprire:", e)
    return jsonify({'status': 'ok'})

@app.route('/api/porneste/<int:id>', methods=['POST'])
def porneste(id):
    global semafor_activ
    if id != semafor_activ:
        return jsonify({'status': 'ignored'})
    if ser:
        try:
            ser.write("porneste\n".encode())
            salveaza_eveniment("Pornire semafor", id)
        except Exception as e:
            print("❌ Eroare pornire:", e)
    return jsonify({'status': 'ok'})

@app.route('/api/noapte/<int:id>', methods=['POST'])
def toggle_noapte(id):
    global semafor_activ
    if id != semafor_activ:
        return jsonify({'status': 'ignored'})
    if ser:
        try:
            ser.write("toggle_noapte\n".encode())
            salveaza_eveniment("Toggle noapte", id)
        except Exception as e:
            print("❌ Eroare toggle_noapte:", e)
    return jsonify({'status': 'ok'})

@app.route('/api/next/<int:id>', methods=['POST'])
def next(id):
    global semafor_activ
    if id != semafor_activ:
        return jsonify({'status': 'ignored'})
    if ser:
        try:
            ser.write("next\n".encode())
            salveaza_eveniment("Trecere următoare", id)
        except Exception as e:
            print("❌ Eroare next:", e)
    return jsonify({'status': 'ok'})

@app.route('/api/temperatura', methods=['POST'])
def temp():
    if ser:
        try:
            ser.write("cere_temp\n".encode())
            salveaza_eveniment("Cerere temperatura")
        except Exception as e:
            print("❌ Eroare temp:", e)
    return jsonify({'status': 'ok'})


@app.route('/api/pietoni')
def api_pietoni():
    limita = datetime.utcnow() - timedelta(seconds=3)  # verifică apăsările din ultimele 3 secunde
    evenimente = Eveniment.query.filter(
        Eveniment.tip == "Buton pieton",
        Eveniment.timestamp >= limita
    ).all()
    return jsonify([{
        'semafor': e.semafor,
        'timestamp': e.timestamp.strftime("%Y-%m-%d %H:%M:%S")
    } for e in evenimente])

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
