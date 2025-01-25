const mqtt = require("mqtt");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(
  cors({
    origin: "https://smartaxiom.netlify.app", // Allow only your Netlify site
  })
);

const brokerUrl = "mqtt://gull.rmq.cloudamqp.com";
const mqttOptions = {
  username: "ejumsfuq:ejumsfuq",
  password: "23apT7-ha1RDMnhhjNOSPUYlCcXZeURj",
};

const client = mqtt.connect(brokerUrl, mqttOptions);
const port = process.env.PORT || 3000;

// File to persist device states
const STATE_FILE = "device_state.json";

// Load persisted device state
let devices = {};
if (fs.existsSync(STATE_FILE)) {
  devices = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

// Save device state to a file
const saveDeviceState = () => {
  fs.writeFileSync(STATE_FILE, JSON.stringify(devices, null, 2));
};

// MQTT event handlers
client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe("global/discovery");
  client.subscribe("+/status");
  client.subscribe("+/telemetry");
});

client.on("message", (topic, message) => {
  const payload = JSON.parse(message.toString());
  const deviceId = topic.split("/")[0];

  if (topic === "global/discovery") {
    devices[payload.id] = {
      id: payload.id,
      firmware: payload.firmware,
      capabilities: payload.capabilities,
      status: "online",
      telemetry: null,
      telemetryHistory: [],
    };
    saveDeviceState();
    console.log("Device discovered:", payload);
  } else if (topic.endsWith("/status")) {
    if (devices[deviceId]) {
      devices[deviceId].status = payload.status;
      saveDeviceState();
      console.log(`Device ${deviceId} is now ${payload.status}`);
    }
  } else if (topic.endsWith("/telemetry")) {
    if (devices[deviceId]) {
      const telemetry = {
        ...payload,
        timestamp: Date.now(),
      };
      devices[deviceId].telemetry = telemetry;

      // Maintain telemetry history (last 10 entries)
      devices[deviceId].telemetryHistory.push(telemetry);
      if (devices[deviceId].telemetryHistory.length > 10) {
        devices[deviceId].telemetryHistory.shift();
      }

      saveDeviceState();
      console.log(`Telemetry from ${deviceId}:`, telemetry);
    }
  }
});

// API to fetch devices
app.get("/devices", (req, res) => {
  res.json(devices);
});

// API to send commands to devices
app.post("/devices/:id/commands", express.json(), (req, res) => {
  const deviceId = req.params.id;
  const command = req.body;

  if (devices[deviceId]) {
    const topic = `${deviceId}/commands`;
    client.publish(topic, JSON.stringify(command));
    res.json({ success: true, message: "Command sent successfully!" });
  } else {
    res.status(404).json({ error: "Device not found" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
