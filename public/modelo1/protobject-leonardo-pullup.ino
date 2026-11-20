// Firmware de Protobject para Arduino Leonardo, con resistencias pull-up internas.
//
// Origen: el sketch «Arduino Leonardo» de https://framework.protobject.com/components/arduino.html
// Único cambio: los pines 7, 8 y 9 usan INPUT_PULLUP en vez de INPUT. Así el interruptor (D7),
// el botón Arrancar (D8) y el microinterruptor de tope (D9) van de su pin a GND, sin resistencias:
// abierto se lee 1 y cerrado se lee 0. El resto queda idéntico para que Protobject.Arduino funcione.
//
// Se carga UNA sola vez, desde el computador, con el Arduino IDE:
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

void setup() {
  while (!Serial) {
    ;
  }
  Serial.begin(9600);
  Serial.write("Sketch begins.\r\n> ");
  Serial.flush();
  lservo.attach(5);
  rservo.attach(6);
  pinMode(7, INPUT_PULLUP);   // cambio: interruptor de tipo de día a GND
  pinMode(8, INPUT_PULLUP);   // cambio: botón Arrancar a GND
  pinMode(9, INPUT_PULLUP);   // cambio: microinterruptor de tope a GND
  pinMode(3, OUTPUT);
  pinMode(11, OUTPUT);
  pinMode(13, OUTPUT);
  rservo.writeMicroseconds(defaultR);
  lservo.writeMicroseconds(defaultL);
}

void loop() {
  const auto deser_err = deserializeJson(dynamicJSONDocument, Serial);
  if (!deser_err){
      JsonObject obj = dynamicJSONDocument.as<JsonObject>();
      if (obj["device"] == "robot") { //and servos in general, continuous and angular
        int rightSpeed = obj["right"];
        int leftSpeed = obj["left"];
        rservo.writeMicroseconds(defaultR-rightSpeed);
        lservo.writeMicroseconds(defaultL+leftSpeed);
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
