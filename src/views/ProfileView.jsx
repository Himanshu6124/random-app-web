import React, { useState, useEffect } from 'react';
import { useAuth, INTEREST_TAGS } from '../context/AuthContext';
import { User, Sparkles, Check, Save, Key, Lock, AlertCircle } from 'lucide-react';

export function ProfileView() {
  const { user, isGuest, updateUserProfile, jwtToken, logout, profilePictures, openUpgradeModal } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || user?.username || '');
  const [avatar, setAvatar] = useState(user?.photoUrl || '/userImages/boy1.png');
  const [gender, setGender] = useState(user?.gender || 'boy');
  const [bio, setBio] = useState(user?.bio || '');
  const [userInterests, setUserInterests] = useState(user?.interests || []);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (user?.username) setUsername(user.username);
    if (user?.name) setName(user.name);
    if (user?.photoUrl) setAvatar(user.photoUrl);
    if (user?.gender) setGender(user.gender);
    if (user?.bio) setBio(user.bio);
  }, [user]);

  if (!user) return null;

  const boyAvatars = [
    '/userImages/boy1.png',
    '/userImages/boy2.png',
    '/userImages/boy3.png',
    '/userImages/boy4.png',
    '/userImages/boy5.png',
    '/userImages/boy6.png',
    '/userImages/boy7.png',
    '/userImages/boy8.png'
  ];

  const girlAvatars = [
    '/userImages/girl1.png',
    '/userImages/girl2.png',
    '/userImages/girl3.png',
    '/userImages/girl4.png',
    '/userImages/girl5.png',
    '/userImages/girl6.png',
    '/userImages/girl7.png',
    '/userImages/girl8.png'
  ];

  const currentGender = (gender || 'boy').toLowerCase();
  const genderPictures = currentGender === 'girl' ? girlAvatars : boyAvatars;

  const handleGenderChange = (newGender) => {
    setGender(newGender);
    if (newGender === 'girl' && !avatar.includes('/girl')) {
      setAvatar('/userImages/girl1.png');
    } else if (newGender === 'boy' && !avatar.includes('/boy')) {
      setAvatar('/userImages/boy1.png');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError('');

    try {
      const profileData = isGuest ? {
        name: name.trim(),
        gender: gender.toLowerCase()
      } : {
        username: username.trim(),
        name: name.trim(),
        gender: gender.toLowerCase(),
        bio: bio.trim(),
        photoUrl: avatar,
        interests: userInterests
      };

      await updateUserProfile(profileData);
      setSavedSuccess(true);
      setTimeout(() => { setSavedSuccess(false); }, 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile.');
    } finally {
      setSaveLoading(false);
    }
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {isGuest ? 'Guest Avatar:' : `Choose ${currentGender === 'girl' ? 'Female' : 'Male'} Avatar:`}
              </label>
              {isGuest && (
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} /> Auto-assigned by gender
                </span>
              )}
            </div>

            {isGuest ? (
              <div
                id="guest-avatar-locked-card"
                onClick={() => openUpgradeModal('choose a custom avatar')}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', fontSize: '0.88rem', fontWeight: 600 }}>
                  <Lock size={16} />
                  <span>Avatar Selection Locked</span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Upgrade to a full account to choose from 8 exclusive {currentGender === 'girl' ? 'female' : 'male'} avatars.
                </span>
              </div>
            ) : (
              <div id="profile-avatar-grid" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {genderPictures.map((picUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(picUrl)}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: avatar === picUrl ? '3px solid #10b981' : '1px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.2s ease',
                      boxShadow: avatar === picUrl ? '0 0 15px rgba(16, 185, 129, 0.6)' : 'none'
                    }}
                  >
                    <img src={picUrl} alt={`Avatar ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Username (Editable for full accounts, locked for guests) */}
          <div
            style={{ marginBottom: '20px' }}
            onClick={() => { if (isGuest) openUpgradeModal('customize your username'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Username (@):
              </label>
              {isGuest && (
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <Lock size={12} /> Upgrade to customize
                </span>
              )}
            </div>
            <input
              id="profile-username-input"
              type="text"
              value={isGuest ? (user.username || '') : username}
              onChange={(e) => !isGuest && setUsername(e.target.value)}
              disabled={isGuest}
              placeholder="Your handle..."
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: isGuest ? 'rgba(255, 255, 255, 0.05)' : 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: isGuest ? 'var(--text-muted)' : 'white',
                fontSize: '0.95rem',
                outline: 'none',
                cursor: isGuest ? 'pointer' : 'text'
              }}
            />
          </div>

          {/* Display Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Display Name:
            </label>
            <input
              id="profile-name-input"
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
                  id={`gender-select-${g}`}
                  type="button"
                  onClick={() => handleGenderChange(g)}
                  className={currentGender === g ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', textTransform: 'capitalize' }}
                >
                  {g === 'boy' ? '👦 Male (Boy)' : '👧 Female (Girl)'}
                </button>
              ))}
            </div>
          </div>

          {/* Bio Input */}
          <div
            style={{ marginBottom: '24px' }}
            onClick={() => { if (isGuest) openUpgradeModal('add a custom bio'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Bio:
              </label>
              {isGuest && (
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <Lock size={12} /> Upgrade to customize
                </span>
              )}
            </div>
            <textarea
              id="profile-bio-input"
              value={isGuest ? 'Custom bio is locked for guest accounts.' : bio}
              onChange={(e) => !isGuest && setBio(e.target.value)}
              disabled={isGuest}
              placeholder="Tell strangers a bit about yourself..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: isGuest ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: isGuest ? 'var(--text-muted)' : 'white',
                fontSize: '0.95rem',
                outline: 'none',
                resize: 'none',
                fontFamily: 'var(--font-main)',
                cursor: isGuest ? 'pointer' : 'text'
              }}
            />
          </div>

          {/* Personal Interests Selector */}
          <div
            style={{ marginBottom: '32px' }}
            onClick={() => { if (isGuest) openUpgradeModal('select personal interests'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Favorite Topics:
              </label>
              {isGuest && (
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <Lock size={12} /> Upgrade to choose
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {INTEREST_TAGS.map(tag => {
                const isSelected = !isGuest && userInterests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={isGuest}
                    onClick={() => !isGuest && toggleInterest(tag)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '1px solid var(--cyan-accent)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      cursor: isGuest ? 'pointer' : 'pointer',
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

          {saveError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={16} />
              <span>{saveError}</span>
            </div>
          )}

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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {jwtToken ? 'Your session is active on this device' : 'Valid local session token'}
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
