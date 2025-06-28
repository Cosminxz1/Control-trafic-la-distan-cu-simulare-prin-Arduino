#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int ledRosu = 11;
const int ledGalben = 12;
const int ledVerde = 13;
const int butonPieton = 7;
const int pinTemperatura = A0;

enum Stare { ROSU, VERDE, GALBEN };
Stare stareCurenta = ROSU;

int semaforSelectat = 1;
bool semaforPornit = true;
bool modNoapte = false;

unsigned long durataEtapa = 60000;
unsigned long startEtapa = 0;

bool pietonApasat = false;

void setup() {
  Serial.begin(9600);
  pinMode(ledRosu, OUTPUT);
  pinMode(ledGalben, OUTPUT);
  pinMode(ledVerde, OUTPUT);
  pinMode(butonPieton, INPUT_PULLUP);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Semafor Arduino");
  afiseazaPeLCD("ROSU", -1);
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    proceseazaComanda(cmd);
  }

  if (modNoapte) {
    static unsigned long tBlink = 0;
    if (millis() - tBlink > 500) {
      digitalWrite(ledRosu, LOW);
      digitalWrite(ledVerde, LOW);
      digitalWrite(ledGalben, !digitalRead(ledGalben));
      tBlink = millis();
    }
    afiseazaPeLCD("NOAPTE", -1);
    return;
  }

  if (!semaforPornit) {
    afiseazaPeLCD("OPRIT", -1);
    return;
  }

  // Actualizare LCD la fiecare secundă
  static unsigned long ultimaAfisare = 0;
  if (millis() - ultimaAfisare >= 1000) {
    int ramas = (durataEtapa - (millis() - startEtapa)) / 1000;
    if (ramas < 0) ramas = 0;
    afiseazaPeLCD(numeEtapa(stareCurenta), ramas);
    ultimaAfisare = millis();
  }

  // Apăsare pieton
  static bool butonAnterior = HIGH;
  bool citireButon = digitalRead(butonPieton);
  if (stareCurenta == VERDE && citireButon == LOW && butonAnterior == HIGH && !pietonApasat) {
    Serial.print("PIETON_APASAT_S");
    Serial.println(semaforSelectat);
    pietonApasat = true;
  }
  butonAnterior = citireButon;

  // Temperatură periodic
  static unsigned long tTemp = 0;
  if (millis() - tTemp > 5000) {
    float temp = citesteTemperatura();
    Serial.print("TEMP:");
    Serial.println(temp);
    tTemp = millis();
  }
}

void proceseazaComanda(String cmd) {
  if (cmd.startsWith("select ")) {
    int sp1 = cmd.indexOf(' ', 7);
    int sp2 = cmd.indexOf(' ', sp1 + 1);

    if (sp1 != -1 && sp2 != -1) {
      semaforSelectat = cmd.substring(7, sp1).toInt();
      String stareStr = cmd.substring(sp1 + 1, sp2);
      int timpRamas = cmd.substring(sp2 + 1).toInt();

      modNoapte = false;
      semaforPornit = true;

      if (stareStr == "ROSU") stareCurenta = ROSU;
      else if (stareStr == "GALBEN") stareCurenta = GALBEN;
      else if (stareStr == "VERDE") {
        stareCurenta = VERDE;
        pietonApasat = false;
      }

      durataEtapa = timpRamas * 1000UL;
      startEtapa = millis();

      actualizeazaLEDuri();
      afiseazaPeLCD(stareStr, timpRamas);
    }

  } else if (cmd == "opreste") {
    semaforPornit = false;
    modNoapte = false;
    digitalWrite(ledRosu, LOW);
    digitalWrite(ledGalben, LOW);
    digitalWrite(ledVerde, LOW);
    afiseazaPeLCD("OPRIT", -1);
  }

  else if (cmd == "porneste") {
    semaforPornit = true;
    actualizeazaLEDuri();
    startEtapa = millis();
  }

  else if (cmd == "toggle_noapte") {
    modNoapte = !modNoapte;
    digitalWrite(ledRosu, LOW);
    digitalWrite(ledGalben, LOW);
    digitalWrite(ledVerde, LOW);
    if (!modNoapte) {
      actualizeazaLEDuri();
    }
  }

  else if (cmd == "cere_temp") {
    float temp = citesteTemperatura();
    Serial.print("TEMP:");
    Serial.println(temp);
  }
}

void actualizeazaLEDuri() {
  digitalWrite(ledRosu, stareCurenta == ROSU);
  digitalWrite(ledGalben, stareCurenta == GALBEN);
  digitalWrite(ledVerde, stareCurenta == VERDE);
}

void afiseazaPeLCD(String etapa, int secunde) {
  lcd.setCursor(0, 1);
  lcd.print("S");
  lcd.print(semaforSelectat);
  lcd.print(" ");
  lcd.print(etapa);
  if (secunde >= 0) {
    lcd.print(" ");
    lcd.print(secunde);
    lcd.print("s ");
  }
  lcd.print("   ");
}

String numeEtapa(Stare s) {
  if (s == ROSU) return "ROSU ";
  if (s == VERDE) return "VERDE";
  if (s == GALBEN) return "GALBEN";
  return "????";
}

float citesteTemperatura() {
  int citire = analogRead(pinTemperatura);
  float tensiune = citire * (5.0 / 1023.0);
  return tensiune * 100.0;
}
