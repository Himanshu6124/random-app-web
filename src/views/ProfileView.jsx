import React, { useState } from 'react';
import { useAuth, INTEREST_TAGS } from '../context/AuthContext';
import { User, Sparkles, Check, Save, Key } from 'lucide-react';

export function ProfileView() {
  const { user, isGuest, updateUserProfile, jwtToken, logout, profilePictures, openUpgradeModal } = useAuth();

  const [name, setName] = useState(user?.name || user?.username || '');
  const [avatar, setAvatar] = useState(user?.photoUrl || '/userImages/boy1.png');
  const [gender, setGender] = useState(user?.gender || 'boy');
  const [bio, setBio] = useState(user?.bio || '');
  const [userInterests, setUserInterests] = useState(user?.interests || []);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  if (!user) return null;

  const defaultAvatars = [
    '/userImages/boy1.png',
    '/userImages/boy2.png',
    '/userImages/boy3.png',
    '/userImages/boy4.png',
    '/userImages/girl1.png',
    '/userImages/girl2.png',
    '/userImages/girl3.png',
    '/userImages/girl4.png'
  ];

  const availablePictures = Array.isArray(profilePictures) && profilePictures.length > 0
    ? profilePictures
    : defaultAvatars;

  const handleSave = (e) => {
    e.preventDefault();
    setSaveLoading(true);

    const profileData = {
      name,
      gender,
      bio,
      photoUrl: avatar,
      interests: userInterests
    };

    updateUserProfile(profileData);
    setSavedSuccess(true);
    setSaveLoading(false);
    setTimeout(() => { setSavedSuccess(false); }, 3000);
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
      <div className="glass-panel profile-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <User size={26} color="var(--primary-purple)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>My Profile</h2>
          {isGuest && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              padding: '3px 8px',
              borderRadius: '8px',
              textTransform: 'uppercase'
            }}>
              Guest Session
            </span>
          )}
        </div>

        {isGuest && (
          <div style={{
            padding: '14px 18px',
            borderRadius: '16px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} color="#a5b4fc" />
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.92rem' }}>Temporary Guest Account</div>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Create a permanent account to keep friends and custom details.</div>
              </div>
            </div>
            <button
              type="button"
              id="profile-upgrade-btn"
              onClick={() => openUpgradeModal('save your profile & friends')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                whiteSpace: 'nowrap'
              }}
            >
              Upgrade Now
            </button>
          </div>
        )}

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
              backgroundColor: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: '16px',
              overflow: 'hidden'
            }}>
              {avatar ? (
                <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                '👤'
              )}
            </div>
            
            {/* Avatar Selector Grid */}
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Choose your Avatar:
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {availablePictures.map((picUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatar(picUrl)}
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
                  <img src={picUrl} alt={`Avatar ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                </button>
              ))}
            </div>
          </div>

          {/* Username (Read Only) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Username (@):
            </label>
            <input
              type="text"
              value={user.username || user.id || ''}
              disabled
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.95rem',
                outline: 'none',
                cursor: 'not-allowed'
              }}
            />
          </div>

          {/* Display Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Display Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name..."
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

          {/* Gender */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Gender:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['boy', 'girl'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={gender === g ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', textTransform: 'capitalize' }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Bio Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Bio:
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
              Favorite Topics:
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
                  JWT Authenticated Session
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
          <div className="profile-action-buttons" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn-danger"
              onClick={logout}
            >
              {isGuest ? 'Exit Guest Session' : 'Sign Out'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {savedSuccess && (
                <span style={{ color: 'var(--green-accent)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={18} /> Profile Saved!
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
