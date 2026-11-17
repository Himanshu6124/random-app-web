import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Check, Save, Lock, AlertCircle, Download, UserRound } from 'lucide-react';

const GENDER_OPTIONS = [['boy', 'Male'], ['girl', 'Female'], ['other', 'Other']];

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
    setBio(user?.bio || '');
  }, [user]);

  if (!user) return null;

  const AVATAR_COUNT = 24;
  const boyAvatars = Array.from({ length: AVATAR_COUNT }, (_, i) => `/userImages/boy${i + 1}.png`);
  const girlAvatars = Array.from({ length: AVATAR_COUNT }, (_, i) => `/userImages/girl${i + 1}.png`);

  const currentGender = (gender || 'boy').toLowerCase();
  const genderPictures = currentGender === 'girl' ? girlAvatars
    : currentGender === 'other' ? [...boyAvatars, ...girlAvatars]
    : boyAvatars;

  const handleGenderChange = (newGender) => {
    setGender(newGender);
    if (newGender === 'girl' && !avatar.includes('/girl')) {
      setAvatar('/userImages/girl1.png');
    } else if (newGender === 'boy' && !avatar.includes('/boy')) {
      setAvatar('/userImages/boy1.png');
    }
  };

  // Save is only enabled once something actually differs from the saved profile.
  const isDirty = isGuest
    ? name.trim() !== (user.name || user.username || '').trim()
      || currentGender !== (user.gender || 'boy').toLowerCase()
    : username.trim() !== (user.username || '').trim()
      || name.trim() !== (user.name || user.username || '').trim()
      || currentGender !== (user.gender || 'boy').toLowerCase()
      || bio.trim() !== (user.bio || '').trim()
      || avatar !== (user.photoUrl || '/userImages/boy1.png');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError('');

    try {
      const profileData = isGuest ? {
        name: name.trim(),
        ...(user.gender ? {} : { gender: gender.toLowerCase() })
      } : {
        username: username.trim(),
        name: name.trim(),
        ...(user.gender ? {} : { gender: gender.toLowerCase() }),
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
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>You're using a guest account</div>
                <div style={{ color: '#c9b6bf', fontSize: 'var(--fs-sm)' }}>Sign in to add friends, pick an avatar and write a bio.</div>
              </div>
            </div>
            <button
              type="button"
              id="profile-upgrade-btn"
              onClick={() => openUpgradeModal('Keep your profile, friends and chats.')}
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
              Sign in
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
                {isGuest ? 'Avatar' : 'Choose avatar'}
              </label>
              {isGuest && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} /> Sign in to change
                </span>
              )}
            </div>

            {isGuest ? (
              <div
                id="guest-avatar-locked-card"
                onClick={() => openUpgradeModal('Sign in to choose your avatar.')}
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
                  <span>Pick your own avatar</span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Sign in to choose the look you like.
                </span>
              </div>
            ) : (
              <div id="profile-avatar-grid" className="avatar-scroll-row" style={{ display: 'flex', gap: '10px', flexWrap: 'nowrap', overflowX: 'auto', width: '100%', padding: '4px 2px 8px' }}>
                {genderPictures.map((picUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(picUrl)}
                    style={{
                      flexShrink: 0,
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
            onClick={() => { if (isGuest) openUpgradeModal('Sign in to pick your username.'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                Username
              </label>
              {isGuest && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <Lock size={12} /> Sign in to edit
                </span>
              )}
            </div>
            <input
              id="profile-username-input"
              type="text"
              value={isGuest ? (user.username || '') : username}
              onChange={(e) => !isGuest && setUsername(e.target.value)}
              disabled={isGuest}
              placeholder="your_handle"
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
              Name
            </label>
            <input
              id="profile-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
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

          {/* Gender: chosen once at first sign-in, then fixed */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Gender
            </label>
            {user.gender ? (
              <div
                id="profile-gender-value"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)'
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {(GENDER_OPTIONS.find(([g]) => g === currentGender) || [null, currentGender])[1]}
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} aria-hidden="true" /> Can't be changed
                </span>
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', gap: '10px' }}>
              {GENDER_OPTIONS.map(([g, label]) => (
                <button
                  key={g}
                  id={`gender-select-${g}`}
                  type="button"
                  onClick={() => handleGenderChange(g)}
                  className={currentGender === g ? 'btn-secondary is-selected' : 'btn-secondary'}
                  style={{ flex: 1, padding: '10px', fontSize: 'var(--fs-md)', textTransform: 'capitalize' }}
                >
                  {label}
                </button>
              ))}
            </div>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Pick carefully: you can't change your gender once it's saved.
                </p>
              </>
            )}
          </div>

          {/* Bio Input */}
          <div
            style={{ marginBottom: '24px' }}
            onClick={() => { if (isGuest) openUpgradeModal('Sign in to add a bio.'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                Bio
              </label>
              {isGuest && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <Lock size={12} /> Sign in to edit
                </span>
              )}
            </div>
            <textarea
              id="profile-bio-input"
              value={isGuest ? '' : bio}
              onChange={(e) => !isGuest && setBio(e.target.value)}
              disabled={isGuest}
              placeholder={isGuest ? 'Sign in to add a bio' : 'A line about you, shown to people you match with'}
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
            <span>Install app</span>
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
                  <Check size={18} /> Saved
                </span>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '12px 32px', opacity: saveLoading || !isDirty ? 0.5 : 1, cursor: saveLoading || !isDirty ? 'not-allowed' : 'pointer' }}
                disabled={saveLoading || !isDirty}
                title={!isDirty ? 'No changes to save' : undefined}
              >
                {saveLoading ? <span className="btn-spinner" /> : <Save size={18} />}
                <span>{saveLoading ? 'Saving…' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
