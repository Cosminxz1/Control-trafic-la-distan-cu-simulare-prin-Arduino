- Clonează proiectul în calculator:

https://github.com/Cosminxz1/Control-trafic-la-distan-cu-simulare-prin-Arduino.git

- Deschide folderul în VS Code.

- Instalează biblioteca necesară pentru Python:
  `pip install flask flask_sqlalchemy pyserial`

- Verifică portul la care este conectat Arduino (ex: COM5) din Device Manager.

- Deschide fișierul `app.py` și setează portul corect:
  `ser = serial.Serial('COM5', 9600, timeout=1)`

- Deschide fișierul `SemaforArduino.ino` în Arduino IDE.

- Instalează biblioteca necesară în Arduino IDE:
  - `LiquidCrystal I2C` de exemplu cea de la Frank de Brabander

- Încarcă sketch-ul pe placă.

- Închide Arduino IDE (pentru a elibera portul COM).

- Rulează aplicația Flask:
  `python app.py`

- Deschide browserul și accesează:
  `http://127.0.0.1:5000`

- Aplicația este acum funcțională: semafoarele funcționează în paralel, Arduino simulează semaforul activ, baza de date salvează evenimentele.
