import pool from '../config/database.js';

export const getProfiles = async (req, res) => {
  try {
    const [profiles] = await pool.query(
      'SELECT * FROM household_profiles WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );

    res.json({ profiles });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
};

export const createProfile = async (req, res) => {
  const {
    name,
    region,
    city,
    diet_type,
    likes,
    dislikes,
    allergies,
    budget,
    cooking_time,
    comfort_foods
  } = req.body;

  if (!name || !region) {
    return res.status(400).json({ error: 'Name and region are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO household_profiles 
       (user_id, name, region, city, diet_type, likes, dislikes, allergies, budget, cooking_time, comfort_foods)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        name,
        region,
        city || null,
        diet_type || 'veg',
        likes || null,
        dislikes || null,
        allergies || null,
        budget || 500,
        cooking_time || 30,
        comfort_foods || null
      ]
    );

    const [newProfile] = await pool.query(
      'SELECT * FROM household_profiles WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Profile created successfully',
      profile: newProfile[0]
    });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
};

export const updateProfile = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Verify ownership
    const [profiles] = await pool.query(
      'SELECT id FROM household_profiles WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await pool.query(
      `UPDATE household_profiles SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await pool.query(
      'SELECT * FROM household_profiles WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Profile updated successfully',
      profile: updated[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const deleteProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM household_profiles WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
};