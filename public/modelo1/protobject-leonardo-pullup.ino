// Firmware de Protobject para Arduino Leonardo, con resistencias pull-up internas y un servo que no anda solo.
//
// Origen: el sketch «Arduino Leonardo» de https://framework.protobject.com/components/arduino.html
// Cambios (el resto queda idéntico para que Protobject.Arduino funcione):
//   1. Los pines 7, 8 y 9 usan INPUT_PULLUP en vez de INPUT. Así el interruptor (D7), el botón Arrancar (D8)
//      y el microinterruptor de tope (D9) van de su pin a GND, sin resistencias: abierto se lee 1 y cerrado, 0.
//   2. El servo no recibe pulsos hasta que la página lo mueve, y el valor 0 lo apaga (sin pulsos, señal en bajo).
//      Un servo de rotación continua sin pulsos no gira, aunque su punto quieto no esté justo en 1.500 µs:
//      así el taxi no anda solo al enchufar el Arduino al celular, al conectarlo en la página ni entre carreras.
//      El original fijaba 1.500 µs al conectar, y Protobject manda 1.501 µs para «quieto».
//   3. Si pasa 1 s sin mensajes de la página (se cerró, se recargó o quedó en segundo plano, o se soltó el cable),
//      el servo se apaga. Con la página abierta no pasa: Protobject pide las lecturas cada 60 ms.
//
// Se carga desde el computador, con el Arduino IDE:
//   1. Bibliotecas: Servo y ArduinoJson (Library Manager) y WebUSB
//      (https://github.com/webusb/arduino; seguir su README, que explica cómo dejar USB_VERSION en 0x210).
//   2. Placa: Arduino Leonardo. Subir este sketch.
// Después el Leonardo se enchufa al celular con un cable OTG y lo maneja la página arduino.html.
//
// Pines (fijos en Protobject): servo continuo en D5 · perilla en A0 · interruptor D7 · botón D8 · tope D9.

#include <Servo.h>
#include <WebUSB.h>
#include <ArduinoJson.h>

WebUSB WebUSBSerial(1 /* https:// */, "");
#define Serial WebUSBSerial

Servo rservo;
Servo lservo;
int defaultL = 1500;
int defaultR = 1500;
DynamicJsonDocument dynamicJSONDocument(128);

const unsigned long SIN_MENSAJES_MS = 1000;   // cambio: tras este tiempo sin mensajes, el servo se apaga
unsigned long ultimoMensaje = 0;

// Cambio: aplica un pulso al servo; con 0 lo apaga (sin pulsos y la señal en bajo).
void mover(Servo &servo, int pin, int us) {
  if (us == 0) {
    if (servo.attached()) servo.detach();
    digitalWrite(pin, LOW);   // detach puede dejar la señal en alto si corta un pulso a la mitad
    return;
  }
  servo.writeMicroseconds(us);              // primero el pulso, para que el primero ya salga con este valor
  if (!servo.attached()) servo.attach(pin);
}

void apagarServos() {
  mover(lservo, 5, 0);
  mover(rservo, 6, 0);
}

void setup() {
  pinMode(5, OUTPUT);         // cambio: la señal del servo en bajo desde el arranque, no flotando
  pinMode(6, OUTPUT);
  apagarServos();
  while (!Serial) {
    ;
  }
  Serial.begin(9600);
  Serial.write("Sketch begins.\r\n> ");
  Serial.flush();
  pinMode(7, INPUT_PULLUP);   // cambio: interruptor de tipo de día a GND
  pinMode(8, INPUT_PULLUP);   // cambio: botón Arrancar a GND
  pinMode(9, INPUT_PULLUP);   // cambio: microinterruptor de tope a GND
  pinMode(3, OUTPUT);
  pinMode(11, OUTPUT);
  pinMode(13, OUTPUT);
  ultimoMensaje = millis();   // cambio: el servo sigue apagado hasta la primera orden
}

void loop() {
  if (millis() - ultimoMensaje > SIN_MENSAJES_MS) apagarServos();   // cambio: la página dejó de hablar
  if (Serial.available() <= 0) return;                             // cambio: sin datos, no esperar bloqueado
  const auto deser_err = deserializeJson(dynamicJSONDocument, Serial);
  if (!deser_err){
      ultimoMensaje = millis();
      JsonObject obj = dynamicJSONDocument.as<JsonObject>();
      if (obj["device"] == "robot") { //and servos in general, continuous and angular
        int rightSpeed = obj["right"];
        int leftSpeed = obj["left"];
        mover(rservo, 6, rightSpeed == 0 ? 0 : defaultR-rightSpeed);   // cambio: 0 apaga el servo
        mover(lservo, 5, leftSpeed == 0 ? 0 : defaultL+leftSpeed);
      }
      if (obj["device"] == "digitalWrite") { //pins 3,11,13
        int pin = obj["pin"];
        int val = obj["val"];
        if (val==1){
          digitalWrite(pin, HIGH);
        } else {
          digitalWrite(pin, LOW);
        }

      }
      if (obj["device"] == "analogWrite") { //pins 3,11,13
        int pin = obj["pin"];
        int val = obj["val"];
        analogWrite(pin, val);
      }
      if (obj["device"] == "readAll") { //digital 7,8,9 //analog 0,1,2
        StaticJsonDocument<200> doc;
        doc["d7"] = digitalRead(7);
        doc["d8"] = digitalRead(8);
        doc["d9"] = digitalRead(9);
        doc["a0"] = analogRead(0);
        doc["a1"] = analogRead(1);
        doc["a2"] = analogRead(2);
        serializeJson(doc, Serial);
        Serial.flush();
      }
    }
}
