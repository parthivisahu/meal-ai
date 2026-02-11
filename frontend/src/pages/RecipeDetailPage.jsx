import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const RecipeDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { meal, day } = location.state || {};

  if (!meal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No recipe data available</p>
          <button
            onClick={() => navigate('/weekly-planner')}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg"
          >
            Back to Planner
          </button>
        </div>
      </div>
    );
  }

  const getMealTypeColor = (mealType) => {
    const colors = {
      breakfast: 'from-orange-50 to-orange-100',
      lunch: 'from-green-50 to-green-100',
      dinner: 'from-blue-50 to-blue-100'
    };
    return colors[mealType] || 'from-gray-50 to-gray-100';
  };

  const getMealIcon = (mealType) => {
    const icons = { breakfast: '🌅', lunch: '🍚', dinner: '🌙' };
    return icons[mealType] || '🍽️';
  };

  // Determine meal type from URL or location state
  const mealType = location.pathname.split('/').pop();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <button
            onClick={() => navigate('/weekly-planner')}
            className="text-orange-600 hover:text-orange-700 mb-4 flex items-center gap-2"
          >
            ← Back to Weekly Planner
          </button>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{getMealIcon(mealType)}</span>
            <div>
              <p className="text-sm text-gray-600">{day}</p>
              <h1 className="text-3xl font-bold text-gray-900">{meal.name}</h1>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="bg-orange-100 px-4 py-2 rounded-full">
              ⏱️ {meal.time}
            </span>
            <span className="bg-green-100 px-4 py-2 rounded-full">
              🔥 {meal.cals}
            </span>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            📦 Ingredients
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {meal.ingredients?.map((ingredient, index) => (
              <div key={index} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                <span className="text-green-600 font-bold mt-1">✓</span>
                <span className="text-gray-700">{ingredient}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            👨‍🍳 Cooking Instructions
          </h2>
          <div className="space-y-4">
            {meal.instructions?.map((instruction, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{instruction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className={`bg-gradient-to-r ${getMealTypeColor(mealType)} border-2 border-gray-200 rounded-2xl p-8 shadow-lg`}>
          <h2 className="text-2xl font-bold mb-4">💡 Cooking Tips</h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Prepare all ingredients before starting to cook (mise en place)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Taste and adjust seasoning as you cook</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Keep all cooking utensils within reach</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Use medium heat unless specified otherwise</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/shopping-list')}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3 rounded-lg font-semibold transition"
          >
            🛒 View Shopping List
          </button>
          <button
            onClick={() => navigate('/weekly-planner')}
            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white py-3 rounded-lg font-semibold transition"
          >
            📅 Back to Weekly Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetailPage;