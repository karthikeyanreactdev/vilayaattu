import type { DriveStep } from "driver.js";

/** Tour content per page. Targets use data-tour attributes. */
export const TOUR_STEPS: Record<"home" | "lobby", DriveStep[]> = {
  home: [
    {
      popover: {
        title: "Vanakkam! 👋",
        description: "Vilayaattu lets you play classic games with friends. No accounts, no downloads. Here's a 30-second tour.",
      },
    },
    {
      element: '[data-tour="create"]',
      popover: { title: "Create a room", description: "Start here. You become the host and get a 6-letter code to share." },
    },
    {
      element: '[data-tour="join"]',
      popover: { title: "Join a friend", description: "Got a code from a friend? Type it here to jump into their room." },
    },
    {
      element: '[data-tour="catalog"]',
      popover: { title: "8 games, one app", description: "Tamil classics, cricket, chess and card games." },
    },
    {
      element: '[data-tour="game-actions"]',
      popover: {
        title: "Online, computer or guide",
        description: "Online finds an open table for that game (or opens one others can join). Computer plays offline at Beginner, Intermediate or Pro. 📖 explains the rules.",
      },
    },
    {
      element: '[data-tour="sound"]',
      popover: { title: "Music & sound", description: "Turn the background music, sound effects and vibration on or off." },
    },
    {
      element: '[data-tour="theme"]',
      popover: { title: "Light or dark", description: "Switch themes any time. Easy on the eyes at night." },
    },
  ],
  lobby: [
    {
      element: '[data-tour="room-code"]',
      popover: { title: "Your room code", description: "Share this code, or tap Invite friends to send a link." },
    },
    {
      element: '[data-tour="players"]',
      popover: { title: "Who's here", description: "Players appear here as they join. The host can add computer players or remove anyone." },
    },
    {
      element: '[data-tour="game-picker"]',
      popover: { title: "Pick a game", description: "The host picks the game. Games that need more players are greyed out." },
    },
    {
      element: '[data-tour="start"]',
      popover: { title: "Start!", description: "When everyone's in, the host taps Start. Use Guide inside any game to see the rules." },
    },
  ],
};
