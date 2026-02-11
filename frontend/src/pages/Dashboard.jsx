import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProfiles: 0,
    totalPlans: 0,
    weeksTracked: 0
  });
  const [todayMeals, setTodayMeals] = useState(null);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadData();
    try {
      const saved = localStorage.getItem('favorite_meals');
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, plansRes] = await Promise.all([
        api.get('/profiles'),
        api.get('/meal-plans')
      ]);

      setProfiles(profilesRes.data.profiles);
      setMealPlans(plansRes.data.mealPlans);

      setStats({
        totalProfiles: profilesRes.data.profiles.length,
        totalPlans: plansRes.data.mealPlans.length,
        weeksTracked: Math.min(plansRes.data.mealPlans.length, 2)
      });

      if (plansRes.data.mealPlans.length > 0) {
        const latestPlan = plansRes.data.mealPlans[0];
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const today = latestPlan.plan_data.weeklyMenu?.find(d => d.day === todayName);
        if (today) setTodayMeals({ day: todayName, ...today, planId: latestPlan.id });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = () => {
    if (profiles.length === 0) {
      navigate('/onboarding');
    } else {
      navigate('/weekly-planner');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-gray-600">
            Your personalized meal planning dashboard
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm mb-1">Household Members</p>
                <p className="text-4xl font-bold">{stats.totalProfiles}</p>
              </div>
              <div className="text-5xl">👥</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm mb-1">Meal Plans Created</p>
                <p className="text-4xl font-bold">{stats.totalPlans}</p>
              </div>
              <div className="text-5xl">📅</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Weeks Tracked</p>
                <p className="text-4xl font-bold">{stats.weeksTracked}</p>
              </div>
              <div className="text-5xl">🔄</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">🎯 Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={handleGeneratePlan}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 rounded-lg font-semibold transition"
              >
                🍽️ Generate New Meal Plan
              </button>
              <button
                onClick={() => navigate('/shopping-list')}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3 rounded-lg font-semibold transition"
              >
                🛒 View Shopping List
              </button>
              <button
                onClick={() => navigate('/cook-now')}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-lg font-semibold transition"
              >
                ? Cook Now
              </button>
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-lg font-semibold transition"
              >
                ➕ Add Household Member
              </button>
              <button
                onClick={() => navigate('/profiles')}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition"
              >
                Manage Household
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">📊 Your Household</h2>
            {profiles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No household members yet</p>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  Add Your First Member
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.slice(0, 3).map((profile) => (
                  <div key={profile.id} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <h3 className="font-semibold text-gray-800">{profile.name}</h3>
                    <p className="text-sm text-gray-600">
                      {profile.region} • {profile.diet_type} • ₹{profile.budget}/week
                    </p>
                  </div>
                ))}
                {profiles.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{profiles.length - 3} more member{profiles.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {todayMeals && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">🍽️ Cook Today</h2>
            <p className="text-sm text-gray-600 mb-4">{todayMeals.day}</p>
            <div className="grid md:grid-cols-3 gap-4">
              {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                <button
                  key={mealType}
                  onClick={() => navigate(`/recipe/${todayMeals.day}/${mealType}`, { state: { meal: todayMeals[mealType], day: todayMeals.day } })}
                  className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-left hover:shadow-md transition"
                >
                  <p className="text-xs uppercase text-gray-500 font-bold mb-1">{mealType}</p>
                  <p className="font-semibold text-gray-800">{todayMeals[mealType]?.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{todayMeals[mealType]?.time} • {todayMeals[mealType]?.cals}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {favorites.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">⭐ Favorites</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {favorites.slice(0, 6).map((name, index) => (
                <div key={index} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-800">{name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Meal Plans */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">📅 Recent Meal Plans</h2>
          {mealPlans.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🍽️</div>
              <p className="text-gray-600 mb-4">No meal plans yet</p>
              <button
                onClick={handleGeneratePlan}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition"
              >
                Create Your First Plan
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {mealPlans.slice(0, 3).map((plan) => (
                <div
                  key={plan.id}
                  className="bg-gradient-to-r from-orange-50 to-green-50 p-6 rounded-lg border-2 border-gray-200 hover:shadow-md transition cursor-pointer"
                  onClick={() => navigate('/weekly-planner', { state: { planId: plan.id } })}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">
                      Week of {new Date(plan.week_start_date).toLocaleDateString()}
                    </h3>
                    <span className="text-sm bg-white px-3 py-1 rounded-full text-gray-600">
                      {plan.plan_data.weeklyMenu?.length || 7} days
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Total Cost: ₹{plan.plan_data.totalCost}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 bg-gradient-to-r from-orange-100 to-green-100 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-center">✨ App Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🔄</div>
              <h3 className="font-bold mb-2">Bi-Weekly Variety</h3>
              <p className="text-sm text-gray-700">No dish repeats for 2 weeks</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🌍</div>
              <h3 className="font-bold mb-2">Regional Cuisine</h3>
              <p className="text-sm text-gray-700">Authentic home-style recipes</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">💰</div>
              <h3 className="font-bold mb-2">Price Comparison</h3>
              <p className="text-sm text-gray-700">Best deals across platforms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

