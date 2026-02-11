import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import Dashboard from './pages/Dashboard';
import WeeklyPlannerPage from './pages/WeeklyPlannerPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import ShoppingListPage from './pages/ShoppingListPage';
import ManageProfilesPage from './pages/ManageProfilesPage';
import CookNowPage from './pages/CookNowPage';
import './App.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
}

function App() {
  const { user } = useAuth();

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App">
        {user && <Navbar />}
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
          
          <Route path="/onboarding" element={
            <PrivateRoute>
              <OnboardingPage />
            </PrivateRoute>
          } />
          
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          
          <Route path="/weekly-planner" element={
            <PrivateRoute>
              <WeeklyPlannerPage />
            </PrivateRoute>
          } />
          
          <Route path="/recipe/:day/:mealType" element={
            <PrivateRoute>
              <RecipeDetailPage />
            </PrivateRoute>
          } />
          
          <Route path="/shopping-list" element={
            <PrivateRoute>
              <ShoppingListPage />
            </PrivateRoute>
          } />
          
          <Route path="/profiles" element={
            <PrivateRoute>
              <ManageProfilesPage />
            </PrivateRoute>
          } />

          <Route path="/cook-now" element={
            <PrivateRoute>
              <CookNowPage />
            </PrivateRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
