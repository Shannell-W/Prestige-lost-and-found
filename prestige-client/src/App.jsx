import { Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Login from './pages/Login';
import Register from './pages/Register';
import Items from './pages/Items';
import Dashboard from "./pages/Dashboard";
import Notifications from './pages/Notifications';
import Claims from './pages/Claims';
import ItemDetails from './pages/ItemDetails';
import ReportItems from './pages/ReportItems';
import Posted from './pages/Posted';
import Profile from './pages/Profile';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/items" element={<Items />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/claims" element={<Claims />} />
      <Route path="/report" element={<ReportItems />} />
      <Route path="/items/:id" element={<ItemDetails />} />
      <Route path="/posted" element={<Posted />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

export default App;