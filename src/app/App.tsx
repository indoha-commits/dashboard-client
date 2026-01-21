import { useEffect, useState } from 'react';
import { CargoList } from './components/CargoList';
import { CargoDetail } from './components/CargoDetail';
import { useAuth } from './auth/AuthContext';

type Screen = 'list' | 'detail';

export default function App() {
  const { ready, authenticated, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('list');
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);

  useEffect(() => {
    // If we got logged out or token refresh failed, bounce back to list.
    if (!authenticated) {
      setCurrentScreen('list');
      setSelectedCargoId(null);
    }
  }, [authenticated]);

  const handleSelectCargo = (cargoId: string) => {
    setSelectedCargoId(cargoId);
    setCurrentScreen('detail');
  };

  const handleBack = () => {
    setCurrentScreen('list');
    setSelectedCargoId(null);
  };

  const handleLogout = async () => {
    await logout();
    // AuthContext will flip `authenticated` to false, which will reset screens.
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    // Redirect to dedicated auth portal (neutral login page)
    const authPortalUrl = import.meta.env.VITE_AUTH_PORTAL_URL as string | undefined;
    if (!authPortalUrl) {
      throw new Error('Missing required env var: VITE_AUTH_PORTAL_URL');
    }
    window.location.href = authPortalUrl;
    return null;
  }

  if (currentScreen === 'detail' && selectedCargoId) {
    return <CargoDetail cargoId={selectedCargoId} onBack={handleBack} />;
  }

  return <CargoList onSelectCargo={handleSelectCargo} onLogout={handleLogout} />;
}
