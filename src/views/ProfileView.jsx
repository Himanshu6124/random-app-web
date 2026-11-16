import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Check, Save, Lock, AlertCircle, Download, UserRound } from 'lucide-react';

export function ProfileView() {
  const { user, isGuest, updateUserProfile, logout, openUpgradeModal } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || user?.username || '');
  const [avatar, setAvatar] = useState(user?.photoUrl || '/userImages/boy1.png');
  const [gender, setGender] = useState(user?.gender || 'boy');
  const [bio, setBio] = useState(user?.bio || '');
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
        photoUrl: avatar
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
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700 }}>My Profile</h2>
          {isGuest && (
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)'
            }}>
              Guest
            </span>
          )}
        </div>

        {isGuest && (
          <div style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(240, 114, 137, 0.12)',
            border: '1px solid rgba(240, 114, 137, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>Temporary Guest Account</div>
                <div style={{ color: '#c9b6bf', fontSize: 'var(--fs-sm)' }}>Create a permanent account to keep friends and custom details.</div>
              </div>
            </div>
            <button
              type="button"
              id="profile-upgrade-btn"
              onClick={() => openUpgradeModal('save your profile & friends')}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                border: 'none',
                fontWeight: 700,
                fontSize: 'var(--fs-md)',
                cursor: 'pointer',
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
              backgroundColor: 'var(--plum-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--fs-3xl)',
              marginBottom: '16px',
              overflow: 'hidden'
            }}>
              {avatar ? (
                <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <UserRound size={18} aria-hidden="true" />
              )}
            </div>
            
            {/* Avatar Selector Grid */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
              <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)' }}>
                {isGuest ? 'Guest Avatar:' : `Choose ${currentGender === 'girl' ? 'Female' : 'Male'} Avatar:`}
              </label>
              {isGuest && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--plum-3)',
                  border: '1px dashed var(--border-strong)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>
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
                      border: avatar === picUrl ? '3px solid #3fb27f' : '1px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.2s ease',
                      boxShadow: avatar === picUrl ? '0 0 0 2px var(--accent)' : 'none'
                    }}
                  >
                    <img src={picUrl} alt={`Avatar ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  </button>
                ))}
              </div>
            )}
            <p id="avatar-credit" style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              Avatars: “Adventurer” by{' '}
              <a href="https://www.instagram.com/lischi_art/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Lisa Wischofsky</a>
              {' '}via{' '}
              <a href="https://www.dicebear.com/styles/adventurer/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>DiceBear</a>,{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>CC BY 4.0</a>
            </p>
          </div>

          {/* Username (Editable for full accounts, locked for guests) */}
          <div
            style={{ marginBottom: '20px' }}
            onClick={() => { if (isGuest) openUpgradeModal('customize your username'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                Username (@):
              </label>
              {isGuest && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
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
                color: isGuest ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 'var(--fs-body)',
                outline: 'none',
                cursor: isGuest ? 'pointer' : 'text'
              }}
            />
          </div>

          {/* Display Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
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
                color: 'var(--text-primary)',
                fontSize: 'var(--fs-body)',
                outline: 'none'
              }}
            />
          </div>

          {/* Gender */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Gender:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['boy', 'girl'].map(g => (
                <button
                  key={g}
                  id={`gender-select-${g}`}
                  type="button"
                  onClick={() => handleGenderChange(g)}
                  className={currentGender === g ? 'btn-secondary is-selected' : 'btn-secondary'}
                  style={{ flex: 1, padding: '10px', fontSize: 'var(--fs-md)', textTransform: 'capitalize' }}
                >
                  {g === 'boy' ? 'Male (Boy)' : 'Female (Girl)'}
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
              <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                Bio:
              </label>
              {isGuest && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
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
                color: isGuest ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 'var(--fs-body)',
                outline: 'none',
                resize: 'none',
                fontFamily: 'var(--font-main)',
                cursor: isGuest ? 'pointer' : 'text'
              }}
            />
          </div>

          {saveError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-tint)',
              border: '1px solid var(--danger-line)',
              color: 'var(--danger)',
              fontSize: 'var(--fs-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={16} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Phone only (see mobile.css): reopen the Add to Home Screen sheet */}
          <button
            type="button"
            className="btn-secondary profile-install-btn"
            onClick={() => window.dispatchEvent(new Event('rm:show-install'))}
          >
            <Download size={18} />
            <span>Install App on Home Screen</span>
          </button>

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
                <span style={{ color: 'var(--green-accent)', fontSize: 'var(--fs-body-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
