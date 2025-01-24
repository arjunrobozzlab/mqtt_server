const mqtt = require("mqtt");
const express = require("express");
const cors = require("cors");

const app = express();
//app.use(cors());

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
const port = 3000;

let devices = {};

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
    console.log("Device discovered:", payload);
  } else if (topic.endsWith("/status")) {
    if (devices[deviceId]) {
      devices[deviceId].status = payload.status;
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

      console.log(`Telemetry from ${deviceId}:`, telemetry);
    }
  }
});


// API to fetch devices
app.get("/devices", (req, res) => {
  res.json(devices);
});

// API to send a command to a device
app.post("/devices/:id/commands", express.json(), (req, res) => {
  const deviceId = req.params.id;
  const command = req.body;

  if (command.action === "set_interval") {
    console.log(`Setting interval for ${deviceId} to ${command.interval} seconds`);
    // Add additional handling logic here if needed
  }
  
  if (devices[deviceId]) {
    const topic = `${deviceId}/commands`;
    client.publish(topic, JSON.stringify(command));
    res.json({ success: true, message: "Command sent successfully!" });
  } else {
    res.status(404).json({ error: "Device not found" });
  }
});

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
