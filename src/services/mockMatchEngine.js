// Interactive Mock Stranger Generator for RandoMeet Demo Mode

const MOCK_STRANGERS = [
  {
    id: 'stranger_1',
    name: 'Alex Cyber',
    avatar: '⚡',
    avatarBg: '#8b5cf6',
    gender: 'Male',
    age: 23,
    country: '⚡ Cyber City',
    bio: 'Software engineer by day, synthwave lover by night.',
    interests: ['Tech', 'Gaming', 'Music'],
    responses: [
      "Hey there! What's up? Are you into tech or gaming?",
      "Haha nice! I'm currently working on a cool project.",
      "That's awesome! Favorite song or video game right now?",
      "Cool vibe! Let's stay in touch!"
    ]
  },
  {
    id: 'stranger_2',
    name: 'Luna Astral',
    avatar: '🌙',
    avatarBg: '#ec4899',
    gender: 'Female',
    age: 21,
    country: '✨ Tokyo',
    bio: 'Anime enthusiast, coffee drinker & digital illustrator.',
    interests: ['Anime', 'Movies', 'Music'],
    responses: [
      "Hii! 🌸 What anime or movies have you watched recently?",
      "Oh I love that one! The visuals were so good!",
      "Coffee + late night chatting is the best mood ✨",
      "Would love to add you as a friend!"
    ]
  },
  {
    id: 'stranger_3',
    name: 'Zenith',
    avatar: '🎧',
    avatarBg: '#06b6d4',
    gender: 'Other',
    age: 24,
    country: '🎧 Berlin',
    bio: 'Electronic music producer & beat maker.',
    interests: ['Music', 'Gaming', 'Chatting'],
    responses: [
      "Yo! Listening to some deep house right now. You like EDM?",
      "That vibe is immaculate! 🎶",
      "I make beats in FL Studio! What are your favorite hobbies?",
      "Nice chatting with you stranger!"
    ]
  },
  {
    id: 'stranger_4',
    name: 'Kira Vortex',
    avatar: '🔥',
    avatarBg: '#f59e0b',
    gender: 'Female',
    age: 22,
    country: '🔥 Los Angeles',
    bio: 'Valorant player & sci-fi enthusiast.',
    interests: ['Gaming', 'Tech', 'Movies'],
    responses: [
      "Hey! What games do you play?",
      "Nice! I'm super competitive in Valorant and Apex.",
      "Lol that's hilarious! 🎯",
      "Great match! Add me to friends!"
    ]
  }
];

export const ICEBREAKER_QUESTIONS = [
  "If you could travel anywhere right now, where would you go?",
  "What is your all-time favorite movie or anime series?",
  "What's a song you can listen to on repeat without getting tired of it?",
  "If you had to eat one cuisine for the rest of your life, what would it be?",
  "Are you a night owl or an early bird?",
  "What is the most underrated video game or tech gadget in your opinion?"
];

export class MockMatchEngine {
  constructor(onMatchFound, onMessageReceived, onTypingStatus) {
    this.onMatchFound = onMatchFound;
    this.onMessageReceived = onMessageReceived;
    this.onTypingStatus = onTypingStatus;
    this.currentPeer = null;
    this.matchTimer = null;
    this.replyTimer = null;
  }

  startSearching(userFilters) {
    this.cancelSearch();

    // Simulate search delay (1.5 to 3 seconds)
    const searchDelay = Math.floor(Math.random() * 1500) + 1500;

    this.matchTimer = setTimeout(() => {
      // Pick stranger matching interests if possible
      let pool = MOCK_STRANGERS;
      if (userFilters.interests && userFilters.interests.length > 0) {
        const filtered = MOCK_STRANGERS.filter(s =>
          s.interests.some(i => userFilters.interests.includes(i))
        );
        if (filtered.length > 0) pool = filtered;
      }

      if (userFilters.gender && userFilters.gender !== 'All') {
        const genderFiltered = pool.filter(s => s.gender === userFilters.gender);
        if (genderFiltered.length > 0) pool = genderFiltered;
      }

      const randomStranger = pool[Math.floor(Math.random() * pool.length)];
      this.currentPeer = randomStranger;

      this.onMatchFound({
        id: randomStranger.id,
        name: randomStranger.name,
        avatar: randomStranger.avatar,
        avatarBg: randomStranger.avatarBg,
        gender: randomStranger.gender,
        age: randomStranger.age,
        country: randomStranger.country,
        bio: randomStranger.bio,
        interests: randomStranger.interests
      });

      // Send initial greeting from stranger after short delay
      setTimeout(() => {
        if (this.currentPeer && this.currentPeer.id === randomStranger.id) {
          const initialGreeting = randomStranger.responses[0];
          this.triggerPeerReply(initialGreeting);
        }
      }, 1000);

    }, searchDelay);
  }

  cancelSearch() {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    if (this.replyTimer) clearTimeout(this.replyTimer);
    this.currentPeer = null;
  }

  sendMessage(text) {
    if (!this.currentPeer) return;

    // Simulate typing and response
    const peerResponses = this.currentPeer.responses;
    const nextResponse = peerResponses[Math.floor(Math.random() * peerResponses.length)];

    // Show typing status after 1s
    setTimeout(() => {
      if (this.onTypingStatus) this.onTypingStatus(true);
    }, 800);

    // Send reply after 2.2s
    this.replyTimer = setTimeout(() => {
      if (this.onTypingStatus) this.onTypingStatus(false);
      this.onMessageReceived({
        id: 'msg_' + Date.now(),
        senderId: this.currentPeer.id,
        senderName: this.currentPeer.name,
        text: nextResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 2200);
  }

  triggerPeerReply(text) {
    if (this.onTypingStatus) this.onTypingStatus(true);
    setTimeout(() => {
      if (this.onTypingStatus) this.onTypingStatus(false);
      this.onMessageReceived({
        id: 'msg_' + Date.now(),
        senderId: this.currentPeer ? this.currentPeer.id : 'stranger',
        senderName: this.currentPeer ? this.currentPeer.name : 'Stranger',
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 1200);
  }
}
