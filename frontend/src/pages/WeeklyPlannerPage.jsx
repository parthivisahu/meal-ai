import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const WeeklyPlannerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedDay, setExpandedDay] = useState(null);
  const [profilesCount, setProfilesCount] = useState(null);
  const [notice, setNotice] = useState('');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    // If planId is passed, load that plan
    if (location.state?.planId) {
      loadMealPlan(location.state.planId);
    } else {
      // Otherwise, load the most recent plan
      loadRecentPlan();
    }
    loadProfiles();
  }, [location.state]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('favorite_meals');
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('favorite_meals', JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }, [favorites]);

  const loadProfiles = async () => {
    try {
      const response = await api.get('/profiles');
      const count = response.data.profiles.length;
      setProfilesCount(count);
      return count;
    } catch (error) {
      console.error('Error loading profiles:', error);
      setProfilesCount(0);
      return 0;
    }
  };

  const loadRecentPlan = async () => {
    setLoading(true);
    try {
      const response = await api.get('/meal-plans');
      if (response.data.mealPlans.length > 0) {
        setMealPlan(response.data.mealPlans[0]);
        console.log('MealPlan from loadRecentPlan:', response.data.mealPlans[0]);
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMealPlan = async (planId) => {
    setLoading(true);
    try {
      const response = await api.get(`/meal-plans/${planId}`);
      setMealPlan(response.data.mealPlan);
      console.log('MealPlan from loadMealPlan:', response.data.mealPlan);
    } catch (error) {
      console.error('Error loading meal plan:', error);
      setError('Failed to load meal plan');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    const count = profilesCount === null ? await loadProfiles() : profilesCount;
    if (count === 0) {
      setError('Please add at least one household member first.');
      navigate('/onboarding');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    
    try {
      const response = await api.post('/meal-plans');
      setMealPlan(response.data.mealPlan);
      console.log('MealPlan from handleGeneratePlan:', response.data.mealPlan);
    } catch (error) {
      console.error('Error generating meal plan:', error);
      setError(error.response?.data?.error || 'Failed to generate meal plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleReplaceMeal = async (dayIndex, mealType) => {
    if (!mealPlan?.id) return;
    setNotice('');
    try {
      const response = await api.post(`/meal-plans/${mealPlan.id}/replace-meal`, {
        dayIndex,
        mealType
      });
      setMealPlan(response.data.mealPlan);
      setNotice('Meal replaced. Shopping list may be outdated.');
    } catch (error) {
      console.error('Error replacing meal:', error);
      setError(error.response?.data?.error || 'Failed to replace meal');
    }
  };

  const toggleFavorite = (meal) => {
    if (!meal?.name) return;
    setFavorites((prev) => (
      prev.includes(meal.name) ? prev.filter(n => n !== meal.name) : [...prev, meal.name]
    ));
  };

  const getMealIcon = (mealType) => {
    const icons = { breakfast: '🌅', lunch: '🍚', dinner: '🌙' };
    return icons[mealType] || '🍽️';
  };

  const getMealColor = (mealType) => {
    const colors = {
      breakfast: 'from-orange-50 to-orange-100 border-orange-200',
      lunch: 'from-green-50 to-green-100 border-green-200',
      dinner: 'from-blue-50 to-blue-100 border-blue-200'
    };
    return colors[mealType] || 'from-gray-50 to-gray-100 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meal plan...</p>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-green-50">
        <div className="text-center bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Creating Your Plan...</h2>
          <p className="text-gray-600 mb-1">AI is analyzing preferences</p>
          <p className="text-sm text-gray-500">Ensuring variety from last 2 weeks</p>
          <p className="text-xs text-orange-600 font-medium mt-3">⏱️ Takes 15-30 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📅 Weekly Meal Planner</h1>
              {mealPlan && (
                <p className="text-gray-600">
                  Week starting: {new Date(mealPlan.week_start_date).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={handleGeneratePlan}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg"
            >
              🔄 Generate New Plan
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-blue-50 border-2 border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6">
            {notice}
          </div>
        )}

        {!mealPlan ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🍽️</div>
            <h2 className="text-2xl font-bold mb-4">No Meal Plan Yet</h2>
            <p className="text-gray-600 mb-6">Generate your first AI-powered meal plan!</p>
            <button
              onClick={handleGeneratePlan}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition shadow-lg"
            >
              🎯 Generate Meal Plan
            </button>
          </div>
        ) : (
          <>
            {/* Why This Works */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 mb-8 shadow-md">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                🌿 Why This Menu Works
              </h3>
              <p className="text-gray-700">{mealPlan.plan_data.reasoning}</p>
            </div>

            {/* Weekly Menu */}
            <div className="space-y-6 mb-8">
              {mealPlan.plan_data.weeklyMenu?.map((day, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedDay(expandedDay === index ? null : index)}
                    className="w-full bg-gradient-to-r from-orange-100 to-green-100 p-6 hover:from-orange-200 hover:to-green-200 transition"
                  >
                    <div className="flex justify-between items-center">
                      <div className="text-left">
                        <h3 className="text-2xl font-bold text-gray-900">{day.day}</h3>
                        <p className="text-sm text-gray-600 mt-1">{day.nutritionBalance || day.balance || ''}</p>
                      </div>
                      <div className="text-2xl">
                        {expandedDay === index ? '▲' : '▼'}
                      </div>
                    </div>
                  </button>

                  {expandedDay === index && (
                    <div className="p-6 space-y-4">
                      {/* Breakfast */}
                      <div
                        className={`bg-gradient-to-r ${getMealColor('breakfast')} border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition`}
                        onClick={() => navigate(`/recipe/${day.day}/breakfast`, { state: { meal: day.breakfast, day: day.day } })}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getMealIcon('breakfast')}</span>
                            <div>
                              <p className="text-xs font-bold uppercase text-orange-600">Breakfast</p>
                              <h4 className="font-bold text-lg">{day.breakfast.name}</h4>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">⏱️ {day.breakfast.time}</p>
                            <p className="text-xs text-gray-600">🔥 {day.breakfast.cals}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">Click to view full recipe →</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(day.breakfast);
                              }}
                              className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-1 rounded-full hover:bg-orange-50"
                            >
                              {favorites.includes(day.breakfast?.name) ? '★' : '☆'} Favorite
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaceMeal(index, 'breakfast');
                              }}
                              className="text-xs bg-white border border-orange-300 text-orange-700 px-2 py-1 rounded-full hover:bg-orange-50"
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Lunch */}
                      <div
                        className={`bg-gradient-to-r ${getMealColor('lunch')} border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition`}
                        onClick={() => navigate(`/recipe/${day.day}/lunch`, { state: { meal: day.lunch, day: day.day } })}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getMealIcon('lunch')}</span>
                            <div>
                              <p className="text-xs font-bold uppercase text-green-600">Lunch</p>
                              <h4 className="font-bold text-lg">{day.lunch.name}</h4>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">⏱️ {day.lunch.time}</p>
                            <p className="text-xs text-gray-600">🔥 {day.lunch.cals}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">Click to view full recipe →</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(day.lunch);
                              }}
                              className="text-xs bg-white border border-green-200 text-green-700 px-2 py-1 rounded-full hover:bg-green-50"
                            >
                              {favorites.includes(day.lunch?.name) ? '★' : '☆'} Favorite
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaceMeal(index, 'lunch');
                              }}
                              className="text-xs bg-white border border-green-300 text-green-700 px-2 py-1 rounded-full hover:bg-green-50"
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dinner */}
                      <div
                        className={`bg-gradient-to-r ${getMealColor('dinner')} border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition`}
                        onClick={() => navigate(`/recipe/${day.day}/dinner`, { state: { meal: day.dinner, day: day.day } })}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getMealIcon('dinner')}</span>
                            <div>
                              <p className="text-xs font-bold uppercase text-blue-600">Dinner</p>
                              <h4 className="font-bold text-lg">{day.dinner.name}</h4>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">⏱️ {day.dinner.time}</p>
                            <p className="text-xs text-gray-600">🔥 {day.dinner.cals}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">Click to view full recipe →</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(day.dinner);
                              }}
                              className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-50"
                            >
                              {favorites.includes(day.dinner?.name) ? '★' : '☆'} Favorite
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaceMeal(index, 'dinner');
                              }}
                              className="text-xs bg-white border border-blue-300 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-50"
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => navigate('/shopping-list', { state: { mealPlan } })}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-4 rounded-xl font-bold text-lg transition shadow-lg"
              >
                🛒 View Shopping List & Compare Prices
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white py-4 rounded-xl font-bold text-lg transition shadow-lg"
              >
                ← Back to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WeeklyPlannerPage;
