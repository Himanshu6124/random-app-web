// Copy for the logged-out landing page (LoginView). Plain data with no JSX, so the build's
// SEO plugin can turn the same FAQ into FAQPage structured data: the visible answers and
// the structured-data answers can never drift apart.
// Only describe features the app actually has (see PRODUCT.md "Evidence on Hand").

export const HERO = {
  title: 'Random chat with strangers who could become friends',
  lead: 'Free, anonymous one-on-one text chat. No signup needed.',
};

export const STEPS = {
  title: 'How RandomChatly works',
  items: [
    {
      title: 'Start in seconds',
      body: 'Continue as a guest with just a name, or sign in with Google to keep your friends and profile.',
    },
    {
      title: 'Meet someone new',
      body: 'RandomChatly connects you with one random stranger who is online now. Stuck for words? Tap an icebreaker.',
    },
    {
      title: 'Keep the good ones',
      body: 'Clicked with someone? With a Google account, send a friend request and keep talking in your messages. If not, tap Next Stranger.',
    },
  ],
};

export const SAFETY = {
  title: 'Anonymous and safe by default',
  items: [
    {
      title: 'Your location stays private',
      body: 'Strangers never see your location. Friends only see a rounded area, never your exact spot, and only if you choose to share it.',
    },
    {
      title: 'Leave or block anytime',
      body: 'Tap Next Stranger to move on, or block someone to end the chat right away.',
    },
    {
      title: 'Report people who cross a line',
      body: 'Signed-in users can report someone from their match history. They are not told who reported them.',
    },
    {
      title: 'Share at your own pace',
      body: 'Keep your full name, phone number and address to yourself until you trust someone.',
    },
  ],
};

export const FAQ = {
  title: 'Questions about random chat',
  items: [
    {
      question: 'What is random chat?',
      answer:
        'Random chat connects you with a stranger picked at random so you can start talking right away. On RandomChatly you are matched one-on-one with someone who is online now, and you chat by text.',
    },
    {
      question: 'Is RandomChatly free?',
      answer: 'Yes. Matching, chatting and adding friends are all free.',
    },
    {
      question: 'Do I need an account to chat?',
      answer:
        'No. Continue as a guest with just a name and start chatting in seconds. Sign in with Google when you want to add friends, keep your chats and set up a profile.',
    },
    {
      question: 'Is it anonymous?',
      answer:
        'Yes. You choose your display name and what you share, and strangers never see your location.',
    },
    {
      question: 'Can I keep talking to someone I meet?',
      answer:
        'Yes. With a Google account you can send a friend request in the middle of a chat. Friends can message each other anytime, send waves, and see everyone they have met.',
    },
    {
      question: 'Is RandomChatly an Omegle alternative?',
      answer:
        'Omegle shut down in November 2023. RandomChatly is a text-first alternative: no webcam, one-on-one matching, and a way to turn a good chat into a friendship.',
    },
  ],
};
