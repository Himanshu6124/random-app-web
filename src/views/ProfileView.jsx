import React, { useState } from 'react';
import { useAuth, AVATAR_LIST, INTEREST_TAGS } from '../context/AuthContext';
import { User, Sparkles, Check, Save } from 'lucide-react';

export function ProfileView() {
  const { user, updateUserProfile } = useAuth();

  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [avatarBg, setAvatarBg] = useState(user.avatarBg);
  const [gender, setGender] = useState(user.gender);
  const [bio, setBio] = useState(user.bio || '');
  const [userInterests, setUserInterests] = useState(user.interests || []);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    updateUserProfile({
      name,
      avatar,
      avatarBg,
      gender,
      bio,
      interests: userInterests
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const toggleInterest = (tag) => {
    setUserInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '30px 20px',
      flex: 1,
      overflowY: 'auto'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '680px', padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <User size={26} color="var(--primary-purple)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Edit My Profile</h2>
        </div>

        <form onSubmit={handleSave}>
          {/* Avatar Preview */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '32px'
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: '16px',
              border: '3px solid rgba(255,255,255,0.2)'
            }}>
              {avatar}
            </div>
            
            {/* Avatar Selector Grid */}
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Choose your Cyber Avatar:
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {AVATAR_LIST.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setAvatar(item.icon);
                    setAvatarBg(item.bg);
                  }}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: item.bg,
                    border: avatar === item.icon ? '3px solid #ffffff' : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: '1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: avatar === item.icon ? '0 0 15px ' + item.bg : 'none'
                  }}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Display Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your username..."
              required
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'white',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Gender Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Gender:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['Male', 'Female', 'Non-binary'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={gender === g ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Bio Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Bio / Mood:
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell strangers a bit about yourself..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'white',
                fontSize: '0.95rem',
                outline: 'none',
                resize: 'none',
                fontFamily: 'var(--font-main)'
              }}
            />
          </div>

          {/* Personal Interests Selector */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>
              My Favorite Topics:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {INTEREST_TAGS.map(tag => {
                const isSelected = userInterests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '1px solid var(--cyan-accent)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isSelected && <Sparkles size={12} color="var(--cyan-accent)" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {savedSuccess ? (
              <span style={{ color: 'var(--green-accent)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={18} /> Profile Saved Successfully!
              </span>
            ) : <span />}

            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '12px 32px' }}
            >
              <Save size={18} />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
