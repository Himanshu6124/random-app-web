# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable, mobile-first PWA (standalone, portrait). Phone use as an installed app is the primary context; desktop browser is secondary.

## Users

People who feel lonely and want connection: new friends, and maybe more. They are open to meeting strangers to get there. They open RandomChatly on their phone, usually late at night, hoping a random chat turns into someone they keep talking to, as a friend or possibly a partner.

## Product Purpose

RandomChatly matches you with a random stranger for a real-time, anonymous 1:1 text chat, and gives that chat a path to become something lasting: a friendship, and maybe more. Success is a stranger becoming someone you come back to message, not just a long chat session.

## Positioning

- **Stranger → friend → maybe more:** a match can send a friend request mid-chat; friends get persistent DMs, waves, and match history ("People you've met"), so connections outlive the random session.
- **Safety and privacy first:** anonymous by default; strangers never see your location; friends only see a rounded area, never an exact spot.
- **Instant, no signup:** guest entry starts a chat in seconds; upgrading to a Google account keeps friends and profile details.
- **Nearby layer:** registered users can see friends who share their location on a map, within a chosen search radius.

## Operating Context

- Core loop: enter (guest or Google) → find a match → chat → "Next Stranger" or add to friends.
- Live alerts arrive while elsewhere in the app: incoming random messages, friend requests, waves.
- Main tabs: Match, Discover (registered only: find friends, nearby friends, match history), Friends (DMs), Profile.
- Icebreaker prompts help start a conversation; audio chimes are optional and mutable.

## Capabilities and Constraints

- **Text-first.** Chat is primarily text; voice notes (max 2 min) and images are secondary, and both depend on Cloudinary being configured. No video.
- **Accounts:** temporary guest accounts with limited features (no friends, no Discover) and Google sign-in with a claimed @username, display name, bio, and avatar.
- **Mobile-first PWA:** must hold up on phone viewports, with on-screen keyboard handling, safe areas, edge-swipe back, and home-screen install.
- **Stack:** React 19 + Vite frontend (`random-app-web`), Spring Boot backend with STOMP WebSockets and REST (`../randomChatabs`), Firebase for auth and storage.
- Real-time features: typing indicators, read receipts, presence, disconnect notices per conversation.
- Undecided: age policy, moderation and reporting flows (backend has user safety endpoints; product rules not confirmed).

## Brand Commitments

- Tone (confirmed): warm and intimate romance — friends first, open to more. Grown-up and tender, never cutesy, never like a corporate tool.

- Name: **RandomChatly**.
- Existing app icon and PWA icons in `public/` (not confirmed as binding).

## Evidence on Hand

- No user counts, testimonials, reviews, press, or retention data exist. Future work must not invent them.
- Real product copy lives in `src/views` and `src/components`.

## Product Principles

1. **Every chat can become something lasting.** Design toward the friend request and the return visit, not endless swiping.
2. **Safe by default.** Privacy and control are visible and never traded for engagement; location is always coarse and opt-in.
3. **Seconds to first hello.** Nothing stands between opening the app and talking to someone; accounts are an upgrade, not a gate.
4. **Words come first.** Text conversation is the core experience; media supports it.
5. **Feels like a native phone app.** Thumb reach, keyboard, and install behave like an app, not a website.
