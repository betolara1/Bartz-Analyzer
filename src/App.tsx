// src/App.tsx
import { useState } from "react";
import Dashboard from "./components/Dashboard";
import ConfigurationScreen from "./components/ConfigurationScreen";

export default function App() {
  const [screen, setScreen] = useState<'dash' | 'cfg'>('dash');
  return screen === 'dash'
    ? <Dashboard onNavigateToConfig={() => setScreen('cfg')} />
    : <ConfigurationScreen onBack={() => setScreen('dash')} />;
}
