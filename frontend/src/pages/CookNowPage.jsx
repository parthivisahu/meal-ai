import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const CookNowPage = () => {
  const navigate = useNavigate();
  const [meal, setMeal] = useState(null);
  const [mealType, setMealType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const loadMeal = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setMeal(null);
    try {
      const response = await api.post('/meal-plans/cook-now');
      setMeal(response.data.meal);
      setMealType(response.data.mealType);
    } catch (err) {
      console.error('Cook now error:', err);
      setError('Failed to generate a quick recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeal();
  }, []);

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

  const copyIngredients = () => {
    if (!meal?.ingredients?.length) return;
    navigator.clipboard.writeText(meal.ingredients.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveFavorite = () => {
    if (!meal?.name) return;
    setFavorites((prev) => (
      prev.includes(meal.name) ? prev : [...prev, meal.name]
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-orange-600 hover:text-orange-700 mb-4"
          >
            {"\u2190"} Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {"\u26A1"} Cook Now
          </h1>
          <p className="text-gray-600">Get a quick recipe for the next meal.</p>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Generating a quick recipe...</p>
          </div>
        )}

        {!loading && meal && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase text-gray-500 font-bold mb-1">{mealType || 'meal'}</p>
                <h2 className="text-2xl font-bold text-gray-900">{meal.name}</h2>
                <div className="flex gap-3 text-sm text-gray-600 mt-2">
                  <span>{"\u23F1"} {meal.time}</span>
                  <span>{"\uD83D\uDD25"} {meal.cals}</span>
                  <span>{"\uD83C\uDF7D"} {meal.serves}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={loadMeal}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition"
                >
                  {loading ? 'Generating...' : '\uD83D\uDD01 Generate Another'}
                </button>
                <button
                  onClick={saveFavorite}
                  className="bg-white border-2 border-orange-200 text-orange-700 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition"
                >
                  {"\u2B50"} Save to Favorites
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">{"\uD83E\uDDFA"} Ingredients</h3>
                <button
                  onClick={copyIngredients}
                  className={`text-xs px-3 py-1 rounded-full border ${copied ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-600'}`}
                >
                  {copied ? '\u2713 Copied' : 'Copy'}
                </button>
              </div>
              <ul className="space-y-2 text-gray-700">
                {meal.ingredients?.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span>{"\u2022"}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-3">{"\uD83D\uDC69\u200D\uD83C\uDF73"} Steps</h3>
              <div className="space-y-3">
                {meal.instructions?.map((step, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-gray-700">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {meal.tips && (
              <div className="mt-6 bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <p className="font-semibold text-orange-700">{"\uD83D\uDCA1"} Tip</p>
                <p className="text-gray-700 mt-1">{meal.tips}</p>
              </div>
            )}
          </div>
        )}

        {favorites.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">{"\u2B50"} Favorites</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {favorites.slice(0, 8).map((name, index) => (
                <div key={index} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-800">{name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookNowPage;
