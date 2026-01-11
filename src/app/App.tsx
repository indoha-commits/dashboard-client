import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { CargoList } from './components/CargoList';
import { CargoDetail } from './components/CargoDetail';

type Screen = 'login' | 'list' | 'detail';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);

  const handleLogin = () => {
    setCurrentScreen('list');
  };

  const handleSelectCargo = (cargoId: string) => {
    setSelectedCargoId(cargoId);
    setCurrentScreen('detail');
  };

  const handleBack = () => {
    setCurrentScreen('list');
    setSelectedCargoId(null);
  };

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (currentScreen === 'detail' && selectedCargoId) {
    return <CargoDetail cargoId={selectedCargoId} onBack={handleBack} />;
  }

  return <CargoList onSelectCargo={handleSelectCargo} />;
}
