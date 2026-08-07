import React, { useState } from 'react';
import { useAuth, AVATAR_LIST, INTEREST_TAGS } from '../context/AuthContext';
import { authService } from '../services/authService';
import { User, Sparkles, Check, Save, Key, AlertCircle } from 'lucide-react';

export function ProfileView() {
  const { user, updateUserProfile, jwtToken, logout, profilePictures } = useAuth();
  if (!user) return null;

  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.photoUrl);
  const [avatarBg, setAvatarBg] = useState(user.avatarBg);
  const [gender, setGender] = useState(user.gender);
  const [bio, setBio] = useState(user.bio || '');
  const [userInterests, setUserInterests] = useState(user.interests || []);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError('');

    const profileData = {
      name,
      gender,
      bio,
      photoUrl: typeof avatar === 'string' && (avatar.startsWith('http') || avatar.startsWith('/')) ? avatar : user.photoUrl,
      interests: userInterests
    };

    try {
      // Try real API update first
      if (user?.id && jwtToken) {
        await authService.updateProfile(user.id, jwtToken, profileData);
      }
    } catch (err) {
      console.warn('[ProfileView] API save failed, updating locally:', err);
      setSaveError('Could not sync to server — saved locally.');
    }

    // Always update local state regardless of API result
    updateUserProfile({ ...profileData, avatar, avatarBg });
    setSavedSuccess(true);
    setSaveLoading(false);
    setTimeout(() => { setSavedSuccess(false); setSaveError(''); }, 3000);
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
              overflow: 'hidden'
            }}>
              {typeof avatar === 'string' && (avatar.startsWith('http') || avatar.startsWith('/')) ? (
                <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                avatar
              )}
            </div>
            
            {/* Avatar Selector Grid (From API Endpoint) */}
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Choose your Profile Picture:
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Array.isArray(profilePictures) && profilePictures.length > 0 ? (
                profilePictures.map((picUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatar(picUrl);
                    }}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: avatar === picUrl ? '3px solid #ffffff' : '1px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.2s ease',
                      boxShadow: avatar === picUrl ? '0 0 15px var(--cyan-accent)' : 'none'
                    }}
                  >
                    <img src={picUrl} alt={`Profile ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))
              ) : (
                AVATAR_LIST.map(item => (
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
                ))
              )}
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

          {/* JWT Authentication Status Badge */}
          <div style={{
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Key size={20} color="var(--primary-purple)" />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  JWT Authenticated Session Active
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
                  {jwtToken ? `${jwtToken.substring(0, 35)}...` : 'Valid local session token'}
                </div>
              </div>
            </div>
            <span className="glass-pill" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--green-accent)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              ● Verified
            </span>
          </div>

          {/* Submit & Logout Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn-danger"
              onClick={logout}
            >
              Sign Out / Logout
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {savedSuccess && (
                <span style={{ color: 'var(--green-accent)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={18} /> Profile Saved!
                </span>
              )}
              {saveError && (
                <span style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> {saveError}
                </span>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '12px 32px', opacity: saveLoading ? 0.7 : 1 }}
                disabled={saveLoading}
              >
                {saveLoading ? <span className="btn-spinner" /> : <Save size={18} />}
                <span>{saveLoading ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
