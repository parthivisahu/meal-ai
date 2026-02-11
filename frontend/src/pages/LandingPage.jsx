import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            🍽️ Smart Meal Planner
          </h1>
          <p className="text-xl text-gray-700 mb-4">
            AI-Powered, Culture-Aware, Budget-Friendly Meal Planning
          </p>
          <p className="text-lg text-gray-600 mb-8">
            No dish repeats for 2 weeks • Regional cuisine support • Automatic shopping lists
          </p>

          <div className="flex justify-center space-x-4 mb-16">
            <Link
              to="/register"
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-300 px-8 py-3 rounded-lg text-lg font-semibold transition"
            >
              Login
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-bold mb-2">Bi-Weekly Variety</h3>
              <p className="text-gray-600">
                Never eat the same dish twice in 2 weeks. AI ensures complete variety.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="text-xl font-bold mb-2">Culture-Aware</h3>
              <p className="text-gray-600">
                Respects regional cuisines from Bengal, Andhra, Chhattisgarh & more.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-2">Budget-Friendly</h3>
              <p className="text-gray-600">
                Compare prices across Blinkit, Zepto, Instamart & BigBasket.
              </p>
            </div>
          </div>

          <div className="mt-16 bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold mb-6">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold text-orange-600">
                  1
                </div>
                <h4 className="font-semibold mb-2">Add Profiles</h4>
                <p className="text-sm text-gray-600">Create profiles for household members</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold text-green-600">
                  2
                </div>
                <h4 className="font-semibold mb-2">Generate Plan</h4>
                <p className="text-sm text-gray-600">AI creates 7-day meal plan</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold text-blue-600">
                  3
                </div>
                <h4 className="font-semibold mb-2">Compare Prices</h4>
                <p className="text-sm text-gray-600">See best deals across platforms</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold text-purple-600">
                  4
                </div>
                <h4 className="font-semibold mb-2">Shop & Cook</h4>
                <p className="text-sm text-gray-600">Order groceries and enjoy meals</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;