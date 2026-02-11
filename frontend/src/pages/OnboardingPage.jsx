import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const OnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfile] = useState({
    name: '',
    region: '',
    city: '',
    diet_type: 'veg',
    likes: '',
    dislikes: '',
    allergies: '',
    budget: 500,
    cooking_time: 30,
    comfort_foods: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAddProfile = () => {
    if (!currentProfile.name || !currentProfile.region) {
      setError('Name and region are required');
      return;
    }

    setProfiles([...profiles, { ...currentProfile, tempId: Date.now() }]);
    setCurrentProfile({
      name: '',
      region: '',
      city: '',
      diet_type: 'veg',
      likes: '',
      dislikes: '',
      allergies: '',
      budget: 500,
      cooking_time: 30,
      comfort_foods: ''
    });
    setError('');
  };

  const handleRemoveProfile = (tempId) => {
    setProfiles(profiles.filter(p => p.tempId !== tempId));
  };

  const handleSubmit = async () => {
    if (profiles.length === 0) {
      setError('Please add at least one household member');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create all profiles
      await Promise.all(
        profiles.map(profile => 
          api.post('/profiles', profile)
        )
      );

      navigate('/dashboard');
    } catch (err) {
      setError('Failed to create profiles. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🎉 Welcome! Let's Set Up Your Household
            </h1>
            <p className="text-gray-600">
              Add household members to get personalized meal plans
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                1
              </div>
              <div className="w-16 h-1 bg-gray-300"></div>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                2
              </div>
            </div>
          </div>

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Add Household Members</h2>
              
              {/* Existing Profiles */}
              {profiles.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Added Members ({profiles.length})</h3>
                  <div className="space-y-2">
                    {profiles.map((profile) => (
                      <div key={profile.tempId} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">{profile.name}</h4>
                          <p className="text-sm text-gray-600">
                            {profile.region} • {profile.diet_type} • ₹{profile.budget}/week
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveProfile(profile.tempId)}
                          className="text-red-500 hover:text-red-700 text-sm px-3 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Profile Form */}
              <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-200 mb-6">
                <h3 className="font-semibold mb-4">Add New Member</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      value={currentProfile.name}
                      onChange={(e) => setCurrentProfile({...currentProfile, name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., Priya"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Region *</label>
                    <input
                      type="text"
                      value={currentProfile.region}
                      onChange={(e) => setCurrentProfile({...currentProfile, region: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., Bengal, Andhra"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input
                      type="text"
                      value={currentProfile.city}
                      onChange={(e) => setCurrentProfile({...currentProfile, city: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., Bangalore"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Diet Type</label>
                    <select
                      value={currentProfile.diet_type}
                      onChange={(e) => setCurrentProfile({...currentProfile, diet_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="vegan">Vegan</option>
                      <option value="veg">Vegetarian</option>
                      <option value="non-veg">Non-Vegetarian</option>
                      <option value="eggetarian">Eggetarian</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Likes</label>
                    <input
                      type="text"
                      value={currentProfile.likes}
                      onChange={(e) => setCurrentProfile({...currentProfile, likes: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="dal, rice, paneer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Dislikes</label>
                    <input
                      type="text"
                      value={currentProfile.dislikes}
                      onChange={(e) => setCurrentProfile({...currentProfile, dislikes: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="brinjal"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Allergies</label>
                    <input
                      type="text"
                      value={currentProfile.allergies}
                      onChange={(e) => setCurrentProfile({...currentProfile, allergies: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="peanuts"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Weekly Budget (₹)</label>
                    <input
                      type="number"
                      value={currentProfile.budget}
                      onChange={(e) => setCurrentProfile({...currentProfile, budget: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Max Cooking Time (min)</label>
                    <input
                      type="number"
                      value={currentProfile.cooking_time}
                      onChange={(e) => setCurrentProfile({...currentProfile, cooking_time: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Comfort Foods</label>
                    <input
                      type="text"
                      value={currentProfile.comfort_foods}
                      onChange={(e) => setCurrentProfile({...currentProfile, comfort_foods: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="dal-rice, khichdi"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddProfile}
                  className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium transition"
                >
                  ➕ Add This Member
                </button>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={profiles.length === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Review & Confirm</h2>
              
              <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg mb-6">
                <p className="text-green-800">
                  ✅ You've added {profiles.length} household member{profiles.length > 1 ? 's' : ''}.
                  We'll use this information to create personalized meal plans!
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {profiles.map((profile, index) => (
                  <div key={profile.tempId} className="bg-white border-2 border-gray-200 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2">Member {index + 1}: {profile.name}</h3>
                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                      <p><span className="font-semibold">Region:</span> {profile.region}</p>
                      <p><span className="font-semibold">City:</span> {profile.city || 'Not specified'}</p>
                      <p><span className="font-semibold">Diet:</span> {profile.diet_type}</p>
                      <p><span className="font-semibold">Budget:</span> ₹{profile.budget}/week</p>
                      <p><span className="font-semibold">Cooking Time:</span> {profile.cooking_time} min</p>
                      <p><span className="font-semibold">Likes:</span> {profile.likes || 'Not specified'}</p>
                      <p><span className="font-semibold">Dislikes:</span> {profile.dislikes || 'None'}</p>
                      <p><span className="font-semibold">Allergies:</span> {profile.allergies || 'None'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold transition"
                >
                  {loading ? 'Saving...' : 'Complete Setup 🎉'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
