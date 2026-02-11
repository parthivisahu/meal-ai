import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const emptyProfile = {
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
};

const ManageProfilesPage = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(emptyProfile);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/profiles');
      setProfiles(response.data.profiles || []);
    } catch (err) {
      console.error('Error loading profiles:', err);
      setError('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (profile) => {
    setEditingId(profile.id);
    setEditData({
      name: profile.name || '',
      region: profile.region || '',
      city: profile.city || '',
      diet_type: profile.diet_type || 'veg',
      likes: profile.likes || '',
      dislikes: profile.dislikes || '',
      allergies: profile.allergies || '',
      budget: profile.budget || 500,
      cooking_time: profile.cooking_time || 30,
      comfort_foods: profile.comfort_foods || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(emptyProfile);
  };

  const saveEdit = async (id) => {
    setError('');
    try {
      const response = await api.put(`/profiles/${id}`, editData);
      const updated = response.data.profile;
      setProfiles(prev => prev.map(p => (p.id === id ? updated : p)));
      cancelEdit();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    }
  };

  const deleteProfile = async (id) => {
    setError('');
    try {
      await api.delete(`/profiles/${id}`);
      setProfiles(prev => prev.filter(p => p.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      console.error('Error deleting profile:', err);
      setError('Failed to delete profile');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-orange-600 hover:text-orange-700 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Household</h1>
          <p className="text-gray-600">Edit or remove household member profiles.</p>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {profiles.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <h2 className="text-2xl font-bold mb-4">No Profiles Yet</h2>
            <p className="text-gray-600 mb-6">Add household members to start planning meals.</p>
            <button
              onClick={() => navigate('/onboarding')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-semibold transition"
            >
              Add Household Members
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {profiles.map(profile => (
              <div key={profile.id} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                {editingId === profile.id ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Region</label>
                      <input
                        type="text"
                        value={editData.region}
                        onChange={(e) => setEditData({ ...editData, region: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">City</label>
                      <input
                        type="text"
                        value={editData.city}
                        onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Diet Type</label>
                      <select
                        value={editData.diet_type}
                        onChange={(e) => setEditData({ ...editData, diet_type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="vegan">Vegan</option>
                        <option value="veg">Vegetarian</option>
                        <option value="eggetarian">Eggetarian</option>
                        <option value="non-veg">Non-Vegetarian</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Likes</label>
                      <input
                        type="text"
                        value={editData.likes}
                        onChange={(e) => setEditData({ ...editData, likes: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Dislikes</label>
                      <input
                        type="text"
                        value={editData.dislikes}
                        onChange={(e) => setEditData({ ...editData, dislikes: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Allergies</label>
                      <input
                        type="text"
                        value={editData.allergies}
                        onChange={(e) => setEditData({ ...editData, allergies: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Weekly Budget (₹)</label>
                      <input
                        type="number"
                        value={editData.budget}
                        onChange={(e) => setEditData({ ...editData, budget: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Cooking Time (min)</label>
                      <input
                        type="number"
                        value={editData.cooking_time}
                        onChange={(e) => setEditData({ ...editData, cooking_time: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Comfort Foods</label>
                      <input
                        type="text"
                        value={editData.comfort_foods}
                        onChange={(e) => setEditData({ ...editData, comfort_foods: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="md:col-span-2 flex gap-3 pt-2">
                      <button
                        onClick={() => saveEdit(profile.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{profile.name}</h3>
                      <p className="text-sm text-gray-600">
                        {profile.region} • {profile.diet_type} • ₹{profile.budget}/week
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Likes: {profile.likes || 'None'} • Dislikes: {profile.dislikes || 'None'} • Allergies: {profile.allergies || 'None'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(profile)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProfile(profile.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageProfilesPage;
