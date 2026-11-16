// Content for the static SEO pages (/how-it-works, /talk-to-strangers, ...).
// vite-plugin-seo.js turns each entry into a plain HTML page at build time (and serves it
// in dev), so search engines get real text without running the app.
//
// Section blocks: { heading, paragraphs?: string[], list?: string[], steps?: {title, body}[] }
// Only describe features the app actually has (see PRODUCT.md "Evidence on Hand").

import { STEPS, SAFETY, FAQ } from './landingContent.js';

/** Extra questions shown only on /faq (the landing page shows FAQ.items). */
const MORE_FAQ = [
  {
    question: 'Is there video chat?',
    answer:
      'No. RandomChatly is text-first: you never have to turn on a camera. Words come first, which keeps chats calmer and more private.',
  },
  {
    question: 'What can guests do, and what needs a Google account?',
    answer:
      'Guests can start random chats right away with just a name. Adding friends, private messages with friends, and the Discover tab need a Google account. You can link one in the middle of a chat without losing it.',
  },
  {
    question: 'What happens when I tap Next Stranger?',
    answer: 'Your current chat ends and RandomChatly looks for someone new who is online now.',
  },
  {
    question: 'Can I install RandomChatly like an app?',
    answer:
      'Yes. Open RandomChatly in your phone browser and add it to your home screen. It opens full screen like a regular app.',
  },
  {
    question: 'How do I block or report someone?',
    answer:
      'Use the block button in the chat to end it right away. Signed-in users can also report someone from their match history; they are not told who reported them.',
  },
];

export const ALL_FAQ = [...FAQ.items, ...MORE_FAQ];

export const SEO_PAGES = [
  {
    slug: 'how-it-works',
    navLabel: 'How it works',
    title: 'How RandomChatly Works: Random Chat in 3 Steps',
    description:
      'Start a random chat in seconds: continue as a guest or with Google, get matched one-on-one, and keep the people you click with as friends.',
    h1: 'How random chat works on RandomChatly',
    intro:
      'RandomChatly matches you with one random stranger for a private, real-time text chat. Here is everything from your first hello to your first friend.',
    sections: [
      { heading: 'Three steps to your first chat', steps: STEPS.items },
      {
        heading: 'Guest or Google account?',
        list: [
          'Guest: enter with just a name and start chatting in seconds. No email needed.',
          'Google account: claim a username, add a photo and bio, add friends, and keep your chats.',
          'Started as a guest? You can link a Google account in the middle of a chat without losing anything.',
        ],
      },
      {
        heading: 'Inside a chat',
        list: [
          'You talk one-on-one with a single person, never a crowded room.',
          'Typing indicators and "Seen" receipts show when the other person is there.',
          'Stuck for words? Tap an icebreaker for a conversation starter.',
          'Tap Next Stranger whenever you want to meet someone else.',
        ],
      },
      {
        heading: 'After the chat',
        paragraphs: [
          'Friends can message each other anytime, send a wave to say hi, and look back at everyone they have met. With location sharing turned on, you can also see friends nearby, shown only as a rounded area.',
        ],
      },
    ],
  },
  {
    slug: 'talk-to-strangers',
    navLabel: 'Talk to strangers',
    title: 'Talk to Strangers Online: Free Text Chat',
    description:
      'Talk to strangers online in a free, anonymous one-on-one text chat. No signup needed, and if you click with someone you can keep them as a friend.',
    h1: 'Talk to strangers online, and maybe make a friend',
    intro:
      'Some nights you just want someone new to talk to. RandomChatly connects you with one stranger who is online now, in a private text chat that starts in seconds.',
    sections: [
      {
        heading: 'Why talk to a stranger?',
        paragraphs: [
          'A stranger has no history with you and no expectations. That makes it easier to be honest, try a new topic, or just pass the time with someone who is also awake and wants to talk.',
          'And sometimes a random chat turns into someone you want to keep talking to. RandomChatly is built for that moment: send a friend request and the conversation can continue tomorrow.',
        ],
      },
      {
        heading: 'How to start a good conversation',
        list: [
          'Open with a question, not just "hi". An icebreaker prompt helps if you are stuck.',
          'Ask about something they enjoy: music, food, a show, their city.',
          'Share a little about yourself too, without personal details.',
          'If the chat is not going anywhere, it is fine to tap Next Stranger.',
        ],
      },
      {
        heading: 'Stay comfortable',
        paragraphs: [
          'Strangers never see your location, and you choose what to share. If someone makes you uncomfortable, block them to end the chat right away.',
        ],
      },
    ],
  },
  {
    slug: 'anonymous-chat',
    navLabel: 'Anonymous chat',
    title: 'Anonymous Chat with Strangers, No Signup',
    description:
      'Chat anonymously with strangers on RandomChatly. Guests need no email, you choose your display name, and strangers never see your location.',
    h1: 'Anonymous chat with strangers',
    intro:
      'On RandomChatly you decide who you are in a chat. Start without an email, pick a display name, and share only what you want to share.',
    sections: [
      {
        heading: 'What stays private',
        list: [
          'Guests do not need an email address or a password.',
          'You choose your display name.',
          'Strangers never see your location.',
          'Friends only see a rounded area, never your exact spot, and only if you choose to share it.',
        ],
      },
      {
        heading: 'Anonymous does not mean anything goes',
        paragraphs: [
          'You can block anyone to end a chat right away, and signed-in users can report someone from their match history. The person is not told who reported them.',
        ],
      },
      {
        heading: 'When you want to stay in touch',
        paragraphs: [
          'Anonymity is the starting point, not a wall. If you click with someone, sign in with Google and send a friend request. You still control what you share on your profile.',
        ],
      },
    ],
  },
  {
    slug: 'omegle-alternative',
    navLabel: 'Omegle alternative',
    title: 'Omegle Alternative: Text-First Random Chat',
    description:
      'Looking for an Omegle alternative? RandomChatly is free, text-first random chat: one-on-one with strangers, no webcam, and a way to keep new friends.',
    h1: 'A text-first Omegle alternative',
    intro:
      'Omegle shut down in November 2023. If you miss meeting someone new at random, RandomChatly keeps that feeling and leaves the webcam out.',
    sections: [
      {
        heading: 'What feels familiar',
        list: [
          'One click to meet a random stranger who is online now.',
          'One-on-one chats, not group rooms.',
          'No account needed to start.',
        ],
      },
      {
        heading: 'What is different',
        list: [
          'Text only: no camera, so chats stay calmer and more private.',
          'Friend requests: a good chat does not have to end when you close the tab.',
          'Location privacy: strangers never see where you are.',
          'Block and report tools built into the app.',
        ],
      },
      {
        heading: 'Is it right for you?',
        paragraphs: [
          'If you want video chat, RandomChatly is not it. If you want real conversations with new people, and a chance that one of them becomes a friend, give it a try.',
        ],
      },
    ],
  },
  {
    slug: 'safety',
    navLabel: 'Safety',
    title: 'Random Chat Safety Tips',
    description:
      'How to stay safe when you chat with strangers: keep personal details private, use block and report, and take your time before trusting someone.',
    h1: 'Safety tips for random chat',
    intro:
      'Most random chats are friendly. These habits keep the rest from becoming a problem.',
    sections: [
      { heading: 'Built into RandomChatly', steps: SAFETY.items },
      {
        heading: 'Good habits when you talk to strangers',
        list: [
          'Do not share your full name, phone number, address, school or workplace with someone you just met.',
          'Never send money or gift cards to someone you met online, whatever the story.',
          'Be careful when someone pushes you to move to another app quickly.',
          'If a chat makes you uncomfortable, leave. You do not owe anyone an explanation.',
          'If you decide to meet a friend in person, choose a public place and tell someone you trust.',
        ],
      },
    ],
  },
  {
    slug: 'faq',
    navLabel: 'FAQ',
    title: 'Random Chat FAQ: Questions About RandomChatly',
    description:
      'Answers about RandomChatly: is it free, do you need an account, is it anonymous, how friend requests work, and how to block or report someone.',
    h1: 'Random chat FAQ',
    intro: 'Quick answers about chatting with strangers on RandomChatly.',
    faq: ALL_FAQ,
    sections: [],
  },
];
