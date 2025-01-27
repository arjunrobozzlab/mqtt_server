import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const API_URL = "https://mqtt-server-po2j.onrender.com";

function Dashboard() {
  const [devices, setDevices] = useState({});
  const [filter, setFilter] = useState("all");
  const [selectedDevices, setSelectedDevices] = useState([]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch(`${API_URL}/devices`);
        const data = await response.json();
        setDevices(data);
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);

    return () => clearInterval(interval);
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
      const response = await fetch(`${API_URL}/devices/${deviceId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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

  const toggleChannel = async (deviceId, channelIndex, currentState) => {
    try {
      const command = {
        action: "toggleChannel",
        channel: channelIndex,
        state: !currentState
      };
      await sendCommand(deviceId, command);
      
      setDevices(prev => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          channelStates: prev[deviceId].channelStates.map((state, idx) =>
            idx === channelIndex ? !state : state
          )
        }
      }));
    } catch (error) {
      console.error(`Error toggling channel ${channelIndex + 1}:`, error);
    }
  };

  const renderTelemetryGraph = (telemetryHistory, deviceId) => {
    if (!telemetryHistory || telemetryHistory.length === 0) {
      return <p>No telemetry data available</p>;
    }

    const data = telemetryHistory.map(entry => ({
      time: new Date(entry.timestamp).toLocaleTimeString(),
      temperature: entry.temperature,
      battery: entry.battery,
      humidity: entry.humidity
    }));

    return (
      <div className="w-full h-[300px] my-4">
        <LineChart width={400} height={300} data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#8884d8" />
          <Line type="monotone" dataKey="battery" name="Battery (V)" stroke="#82ca9d" />
          <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#ffc658" />
        </LineChart>
      </div>
    );
  };

  const filteredDevices = Object.values(devices).filter((device) => {
    if (filter === "all") return true;
    return device.status === filter;
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Smart Building Dashboard</h1>
      <div className="space-x-2 mb-4">
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded" 
          onClick={() => setFilter("all")}
        >
          All Devices
        </button>
        <button 
          className="px-4 py-2 bg-green-500 text-white rounded" 
          onClick={() => setFilter("online")}
        >
          Online Devices
        </button>
        <button 
          className="px-4 py-2 bg-red-500 text-white rounded" 
          onClick={() => setFilter("offline")}
        >
          Offline Devices
        </button>
      </div>
      <div className="mb-4">
        <button 
          className="px-4 py-2 bg-yellow-500 text-white rounded"
          onClick={() => sendBulkCommand({ action: "reboot" })}
        >
          Reboot Selected
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            className="border rounded-lg p-4 shadow-md"
          >
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                className="mr-2"
                onChange={() => toggleDeviceSelection(device.id)}
                checked={selectedDevices.includes(device.id)}
              />
              <h3 className="text-xl font-semibold">{device.id}</h3>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium">Device Info:</h4>
              <p>Firmware: {device.firmware || "N/A"}</p>
              <p>Capabilities: {device.capabilities ? device.capabilities.join(", ") : "None"}</p>
            </div>

            <p className={`mb-4 ${device.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
              Status: {device.status || "Unknown"}
            </p>
            
            {device.telemetry && (
              <div className="mb-4">
                <h4 className="font-medium">Latest Telemetry:</h4>
                <p>Temperature: {device.telemetry.temperature}°C</p>
                <p>Battery: {device.telemetry.battery}V</p>
                <p>Humidity: {device.telemetry.humidity}%</p>
                <p>Motion: {device.telemetry.pir_motion === 1 ? "Detected" : "No Motion"}</p>
                <p>Ambient Light: {device.telemetry.ambient_light}</p>
              </div>
            )}
            
            {device.telemetryHistory
              ? renderTelemetryGraph(device.telemetryHistory, device.id)
              : <p>No telemetry data available</p>}

            {device.channelStates && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Channels:</h4>
                <div className="space-y-2">
                  {device.channelStates.map((state, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <p>Channel {index + 1}: {state ? "ON" : "OFF"}</p>
                      <button
                        className={`px-3 py-1 rounded ${state ? 'bg-green-500' : 'bg-gray-500'} text-white`}
                        onClick={() => toggleChannel(device.id, index, state)}
                      >
                        Toggle Channel {index + 1}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;