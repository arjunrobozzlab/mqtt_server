import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

const API_URL = "https://mqtt-server-po2j.onrender.com";

function Dashboard() {
  const [devices, setDevices] = useState({});
  const [filter, setFilter] = useState("all");
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [intervalStates, setIntervalStates] = useState({});

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await axios.get(`${API_URL}/devices`);
        setDevices(response.data);
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    };

    // Fetch devices every 5 seconds
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);

    // Keep Render service alive by pinging periodically
    const keepAliveInterval = setInterval(() => {
      axios
        .get(API_URL)
        .then(() => console.log("Keep-alive ping sent to server"))
        .catch((err) => console.error("Keep-alive ping failed:", err));
    }, 600000); // Ping every 10 minutes

    return () => {
      clearInterval(interval);
      clearInterval(keepAliveInterval);
    };
  }, []);

  const toggleDeviceSelection = (deviceId) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const sendCommand = async (deviceId, command) => {
    try {
      await axios.post(`${API_URL}/devices/${deviceId}/commands`, command);
      alert(`Command sent to ${deviceId}`);
    } catch (error) {
      console.error("Error sending command:", error);
    }
  };

  const sendBulkCommand = (command) => {
    selectedDevices.forEach((deviceId) => {
      sendCommand(deviceId, command);
    });
    alert("Bulk command sent!");
  };

  const handleIntervalChange = (deviceId, value) => {
    setIntervalStates((prev) => ({
      ...prev,
      [deviceId]: value,
    }));
  };

  const handleSetInterval = (deviceId) => {
    const interval = intervalStates[deviceId];
    if (!interval || isNaN(interval)) {
      alert("Please enter a valid interval (in seconds).");
      return;
    }
    sendCommand(deviceId, { action: "set_interval", interval: Number(interval) });
    setIntervalStates((prev) => ({
      ...prev,
      [deviceId]: "",
    })); // Clear the input field after sending the command
  };

  const toggleChannel = async (deviceId, channelIndex, currentState) => {
    try {
      const command = {
        action: "control_channel",
        channel: channelIndex + 1,
        state: currentState ? 0 : 1,
      };
      await axios.post(`${API_URL}/devices/${deviceId}/commands`, command);
      alert(`Channel ${channelIndex + 1} toggled for ${deviceId}`);
    } catch (error) {
      console.error("Error toggling channel:", error);
    }
  };

  const renderTelemetryGraph = (telemetryHistory, deviceId) => {
    if (!telemetryHistory || telemetryHistory.length === 0) {
      return <p>No telemetry data available</p>;
    }

    const data = {
      labels: telemetryHistory.map((entry) =>
        new Date(entry.timestamp).toLocaleTimeString()
      ),
      datasets: [
        {
          label: "Temperature (°C)",
          data: telemetryHistory.map((entry) => entry.temperature),
          borderColor: "rgba(75,192,192,1)",
          fill: false,
        },
        {
          label: "Battery (V)",
          data: telemetryHistory.map((entry) => entry.battery),
          borderColor: "rgba(255,99,132,1)",
          fill: false,
        },
        {
          label: "Humidity (%)",
          data: telemetryHistory.map((entry) => entry.humidity),
          borderColor: "rgba(153,102,255,1)",
          fill: false,
        },
      ],
    };

    return (
      <div style={{ width: "400px", height: "300px", margin: "10px auto" }}>
        <Line key={deviceId} data={data} />
      </div>
    );
  };

  const filteredDevices = Object.values(devices).filter((device) => {
    if (filter === "all") return true;
    return device.status === filter;
  });

  return (
    <div>
      <h1>Smart Building Dashboard</h1>
      <div>
        <button onClick={() => setFilter("all")}>All Devices</button>
        <button onClick={() => setFilter("online")}>Online Devices</button>
        <button onClick={() => setFilter("offline")}>Offline Devices</button>
      </div>
      <div>
        <button onClick={() => sendBulkCommand({ action: "reboot" })}>
          Reboot Selected
        </button>
      </div>

      <div>
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            style={{
              border: "1px solid black",
              margin: "10px",
              padding: "10px",
            }}
          >
            <input
              type="checkbox"
              onChange={() => toggleDeviceSelection(device.id)}
              checked={selectedDevices.includes(device.id)}
            />
            <h3>{device.id}</h3>
            <div>
              <h4>Device Info:</h4>
              <p>Firmware: {device.firmware || "N/A"}</p>
              <p>Capabilities: {device.capabilities ? device.capabilities.join(", ") : "None"}</p>
            </div>

            <p>Status: {device.status || "Unknown"}</p>
            {device.telemetry && (
              <div>
                <h4>Latest Telemetry:</h4>
                <p>Temperature: {device.telemetry.temperature}°C</p>
                <p>Battery: {device.telemetry.battery}V</p>
                <p>Humidity: {device.telemetry.humidity}%</p>
              </div>
            )}
            {device.telemetryHistory
              ? renderTelemetryGraph(device.telemetryHistory, device.id)
              : <p>No telemetry data available</p>}

            <div>
              <input
                type="number"
                placeholder="Enter interval (s)"
                value={intervalStates[device.id] || ""}
                onChange={(e) => handleIntervalChange(device.id, e.target.value)}
              />
              <button onClick={() => handleSetInterval(device.id)}>Set Interval</button>
            </div>

            <button onClick={() => sendCommand(device.id, { action: "reboot" })}>
              Reboot Device
            </button>

            {/* New Channel Controls */}
            {device.channelStates && (
              <div>
                <h4>Channels:</h4>
                {device.channelStates.map((state, index) => (
                  <div key={index}>
                    <p>
                      Channel {index + 1}: {state ? "ON" : "OFF"}
                    </p>
                    <button onClick={() => toggleChannel(device.id, index, state)}>
                      Toggle Channel {index + 1}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
