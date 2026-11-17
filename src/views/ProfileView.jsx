import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, Save, AlertCircle, Download, UserRound, LogIn } from 'lucide-react';

const AVATARS = {
  boy: Array.from({ length: 8 }, (_, i) => `/userImages/boy${i + 1}.png`),
  girl: Array.from({ length: 8 }, (_, i) => `/userImages/girl${i + 1}.png`),
};

/**
 * Profile: avatar, name, gender and (for signed-in users) username + bio. Guests only edit
 * their name and gender; everything else simply is not shown until they sign in.
 */
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

  const currentGender = (gender || 'boy').toLowerCase() === 'girl' ? 'girl' : 'boy';

  const handleGenderChange = (next) => {
    setGender(next);
    if (!avatar.includes(`/${next}`)) setAvatar(`/userImages/${next}1.png`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError('');
    try {
      await updateUserProfile(isGuest
        ? { name: name.trim(), gender: currentGender }
        : { username: username.trim(), name: name.trim(), gender: currentGender, bio: bio.trim(), photoUrl: avatar });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="glass-panel profile-card">
        <form onSubmit={handleSave} className="profile-form">
          {/* Who you are */}
          <div className="profile-hero">
            <div className="profile-hero__avatar">
              {avatar ? (
                <img src={avatar} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <UserRound size={28} aria-hidden="true" />
              )}
            </div>
            <div className="profile-hero__text">
              <h2>{name || user.username}</h2>
              {isGuest ? <span className="profile-hero__sub">Guest</span>
                : user.username && <span className="profile-hero__sub">@{user.username}</span>}
            </div>
          </div>

          {isGuest && (
            <div className="profile-signin">
              <span>Sign in to keep friends and chats.</span>
              <button
                type="button"
                id="profile-upgrade-btn"
                className="profile-signin__btn"
                onClick={() => openUpgradeModal('Keep your profile, friends and chats.')}
              >
                <LogIn size={15} aria-hidden="true" />Sign in
              </button>
            </div>
          )}

          {!isGuest && (
            <div id="profile-avatar-grid" className="profile-avatars" role="radiogroup" aria-label="Avatar">
              {AVATARS[currentGender].map((pic, idx) => (
                <button
                  key={pic}
                  type="button"
                  role="radio"
                  aria-checked={avatar === pic}
                  aria-label={`Avatar ${idx + 1}`}
                  className={`profile-avatars__item${avatar === pic ? ' is-selected' : ''}`}
                  onClick={() => setAvatar(pic)}
                >
                  <img src={pic} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                </button>
              ))}
            </div>
          )}

          <label className="profile-field">
            <span>Name</span>
            <input
              id="profile-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </label>

          {!isGuest && (
            <label className="profile-field">
              <span>Username</span>
              <input
                id="profile-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle"
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
              />
            </label>
          )}

          <div className="profile-field">
            <span>Gender</span>
            <div className="profile-segmented" role="radiogroup" aria-label="Gender">
              {[['boy', 'Male'], ['girl', 'Female']].map(([g, label]) => (
                <button
                  key={g}
                  id={`gender-select-${g}`}
                  type="button"
                  role="radio"
                  aria-checked={currentGender === g}
                  className={currentGender === g ? 'is-selected' : ''}
                  onClick={() => handleGenderChange(g)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!isGuest && (
            <label className="profile-field">
              <span>Bio</span>
              <textarea
                id="profile-bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A line about you, shown to people you match with"
                rows={2}
                maxLength={160}
              />
            </label>
          )}

          {saveError && (
            <div className="profile-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={saveLoading}>
              {savedSuccess ? <Check size={18} /> : saveLoading ? <span className="btn-spinner" /> : <Save size={18} />}
              <span>{savedSuccess ? 'Saved' : saveLoading ? 'Saving…' : 'Save'}</span>
            </button>
            <button type="button" className="profile-signout" onClick={logout}>
              {isGuest ? 'Exit guest session' : 'Sign out'}
            </button>
          </div>

          {/* Phone only (see mobile.css): reopen the Add to Home Screen sheet */}
          <button
            type="button"
            className="btn-secondary profile-install-btn"
            onClick={() => window.dispatchEvent(new Event('rm:show-install'))}
          >
            <Download size={18} />
            <span>Install app</span>
          </button>

          <p id="avatar-credit" className="profile-credit">
            Avatars:{' '}
            <a href="https://www.instagram.com/lischi_art/" target="_blank" rel="noopener noreferrer">Lisa Wischofsky</a>
            {' '}via{' '}
            <a href="https://www.dicebear.com/styles/adventurer/" target="_blank" rel="noopener noreferrer">DiceBear</a>,{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          </p>
        </form>
      </div>
    </div>
  );
}
