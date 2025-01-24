#include <WiFi.h>
#include <PubSubClient.h>

// WiFi credentials (multiple networks)
const char* ssid1 = "SMARTAXIOM";
const char* password1 = "Amit1305";
const char* ssid2 = "Robozz Lab";
const char* password2 = "Roboitcs@cloud";

// MQTT broker details
const char* mqtt_server = "gull.rmq.cloudamqp.com";
const char* mqtt_username = "ejumsfuq:ejumsfuq";
const char* mqtt_password = "23apT7-ha1RDMnhhjNOSPUYlCcXZeURj";
const int mqtt_port = 1883;

// Device details (dynamically fetched)
String device_id;

// MQTT client setup
WiFiClient espClient;
PubSubClient client(espClient);

// Globals
unsigned long lastTelemetryTime = 0;
unsigned long telemetryInterval = 5000; // Default interval of 5 seconds

void connectToWiFi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(ssid1, password1);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
        delay(1000);
        Serial.print(".");
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nFirst network failed. Trying second network...");
        WiFi.begin(ssid2, password2);
        start = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
            delay(1000);
            Serial.print(".");
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        device_id = "device_" + String(WiFi.macAddress());
        Serial.println("Device ID: " + device_id);
    } else {
        Serial.println("\nFailed to connect to any network");
        device_id = "device_unknown";
    }
}

void connectToMQTT() {
    while (!client.connected()) {
        Serial.println("Connecting to MQTT broker...");
        if (client.connect(device_id.c_str(), mqtt_username, mqtt_password, (device_id + "/status").c_str(), 1, true, "{\"status\":\"offline\"}")) {
            Serial.println("MQTT connected");

            // Publish availability
            client.publish((device_id + "/status").c_str(), "{\"status\":\"online\"}", true);

            // Publish device info to the discovery topic
            String device_info = "{\"id\":\"" + device_id + "\",\"firmware\":\"1.0.0\",\"capabilities\":[\"temp\",\"battery\",\"humidity\"]}";
            client.publish("global/discovery", device_info.c_str());
            Serial.println("Published device info to global/discovery: " + device_info);

            // Subscribe to control topic
            client.subscribe((device_id + "/commands").c_str());
            Serial.println("Subscribed to: " + device_id + "/commands");
        } else {
            Serial.print("Failed, retrying in 5 seconds. Error: ");
            Serial.println(client.state());
            delay(5000);
        }
    }
}

void callback(char* topic, byte* payload, unsigned int length) {
    Serial.print("Message arrived on topic: ");
    Serial.println(topic);

    String message;
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    Serial.println("Message: " + message);

    if (String(topic).endsWith("/commands")) {
        if (message == "{\"action\":\"reboot\"}") {
            Serial.println("Reboot command received!");
            ESP.restart();
        } else if (message.indexOf("\"action\":\"set_interval\"") != -1) {
            int intervalStart = message.indexOf("\"interval\":") + 11;
            int intervalEnd = message.indexOf("}", intervalStart);
            String intervalValue = message.substring(intervalStart, intervalEnd);
            telemetryInterval = intervalValue.toInt() * 1000; // Convert to milliseconds
            Serial.print("Set interval command received: ");
            Serial.print(telemetryInterval / 1000);
            Serial.println(" seconds");
        }
    }
}

void sendTelemetry() {
    // Simulate sensor data
    float temperature = random(20, 30) + random(0, 100) / 100.0;
    float battery = random(30, 100) / 10.0;
    float humidity = random(30, 70) + random(0, 100) / 100.0;
    unsigned long timestamp = millis(); // Placeholder timestamp

    // Create telemetry JSON
    String telemetry = "{";
    telemetry += "\"temperature\":" + String(temperature, 2) + ",";
    telemetry += "\"battery\":" + String(battery, 2) + ",";
    telemetry += "\"humidity\":" + String(humidity, 2) + ",";
    telemetry += "\"timestamp\":" + String(timestamp);
    telemetry += "}";

    // Publish telemetry
    client.publish((device_id + "/telemetry").c_str(), telemetry.c_str());
    Serial.println("Published telemetry to " + device_id + "/telemetry: " + telemetry);
}

void setup() {
    Serial.begin(115200);

    // Connect to WiFi
    connectToWiFi();

    // Set MQTT server and callback
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callback);

    // Connect to MQTT broker
    connectToMQTT();
}

void loop() {
    if (!client.connected()) {
        connectToMQTT();
    }
    client.loop();

    // Check interval and send telemetry
    if (millis() - lastTelemetryTime >= telemetryInterval) {
        sendTelemetry();
        lastTelemetryTime = millis();
    }
}
