/**
 * Player-facing guides shown in the "How to play" panel.
 * Rules live in each game's meta; this adds the goal, controls, tips and terms.
 */

export type GameGuide = {
  goal: string;
  controls: string[];
  tips: string[];
  terms?: { term: string; meaning: string }[];
};

export const GUIDES: Record<string, GameGuide> = {
  "hand-cricket": {
    goal: "Score more runs than your friend by guessing what they won't show.",
    controls: [
      "Tap a hand (1–6) to show your fingers. Your choice stays hidden until both of you pick.",
      "During the toss, the caller taps Heads or Tails. The coin flip picks the winner.",
    ],
    tips: [
      "Batting: big numbers score fast, but they're also the obvious guess.",
      "Bowling: watch for patterns. Many players repeat their favourite number.",
      "With 1 wicket, every ball can end the innings. Play safe when you're ahead.",
    ],
    terms: [
      { term: "Out", meaning: "Batter and bowler showed the same number." },
      { term: "Target", meaning: "First innings score + 1. The chaser must reach it." },
    ],
  },
  ludo: {
    goal: "Get all four tokens to the centre before the other colours.",
    controls: [
      "Tap Roll on your turn. A 6 brings a token out of the yard.",
      "When tokens glow, tap the one you want to move.",
    ],
    tips: [
      "A 6, or sending someone home, gives you another roll.",
      "Starred squares and start squares are safe.",
      "You need the exact number to enter the centre. Extra pips do not count.",
      "Three 6s in a row cancels that turn.",
    ],
    terms: [
      { term: "Yard", meaning: "The corner where your tokens start. Only a 6 lets one out." },
      { term: "Safe", meaning: "A start square or a star. Tokens there cannot be sent home." },
    ],
  },
  "book-cricket": {
    goal: "Flip the book for runs. Highest total after both innings wins.",
    controls: ["When you're batting, tap Flip the book. Bowlers just watch and cheer."],
    tips: [
      "It's pure luck, just like the last bench. Enjoy the drama!",
      "A no-ball (page ending in 8) gives a free run and doesn't use up a ball.",
    ],
    terms: [
      { term: "W", meaning: "Wicket: the page ended in 0." },
      { term: "NB", meaning: "No-ball: page ended in 8, +1 run, extra ball." },
    ],
  },
  pallanguzhi: {
    goal: "Capture more seeds than your opponent.",
    controls: [
      "Your pits are the bottom row. Tap a pit with seeds to sow from it.",
      "Watch the seeds travel. Captured seeds fly to your store.",
    ],
    tips: [
      "Count ahead: aim for your last seed to land just before an empty pit with a full pit after it.",
      "Starving the opponent's side can end the game in your favour.",
      "A pit with exactly 3 seeds is risky: one more makes a pasu for its owner.",
    ],
    terms: [
      { term: "Kuzhi", meaning: "A pit." },
      { term: "Pasu", meaning: "A pit reaching 4 seeds while sowing is taken by that pit's owner." },
    ],
  },
  "aadu-puli": {
    goal: "Tigers: capture goats. Goats: surround the tigers so they can't move.",
    controls: [
      "Goats: tap an empty point to place a goat. After all 15 are placed, tap a goat, then a highlighted point.",
      "Tigers: tap a tiger, then a highlighted point. Red rings mark captures.",
    ],
    tips: [
      "Goats: fill the bottom rows first and move in pairs. A goat with a friend behind it can't be jumped.",
      "Tigers: stay central and keep your tigers apart so goats can't trap them together.",
      "Goats should never leave an empty point directly behind a goat next to a tiger.",
    ],
    terms: [
      { term: "Aadu", meaning: "Goat." },
      { term: "Puli", meaning: "Tiger." },
    ],
  },
  chess: {
    goal: "Checkmate the opposing king.",
    controls: [
      "Tap a piece to see its moves (dots), then tap a target square.",
      "Pawns reaching the last rank let you choose a promotion piece.",
      "Use the ⋯ menu to offer a draw or resign.",
    ],
    tips: [
      "Control the centre early with pawns and knights.",
      "Castle early to keep your king safe.",
      "Before every move, check what your opponent's last move threatens.",
    ],
    terms: [
      { term: "Check", meaning: "The king is under attack and must escape." },
      { term: "Castling", meaning: "King moves two squares toward a rook, which jumps over it." },
      { term: "En passant", meaning: "A special pawn capture right after a two-square pawn move." },
    ],
  },
  kazhuthai: {
    goal: "Get rid of all your cards. Don't be the last one holding cards!",
    controls: [
      "When it's your turn, playable cards lift up. Tap one to play it.",
      "Cards you can't play are dimmed.",
      "A 15-second timer runs on every turn. If it hits zero, your lowest legal card is played. If none can be played, the turn moves on.",
    ],
    tips: [
      "Cutting with a high card of another suit hurts the most: the picker gets everything.",
      "Play your high cards early in a suit while others still follow, so they get thrown away.",
      "Keep track of which suits are running out. That's when cuts happen.",
    ],
    terms: [
      { term: "Vettu (cut)", meaning: "Playing a different suit because you have none of the led suit." },
      { term: "Kazhuthai", meaning: "Donkey: the loser." },
    ],
  },
  onnu: {
    goal: "Be the first to play all your cards.",
    controls: [
      "Glowing cards in your hand can be played. Tap to play.",
      "Wild cards open a colour picker.",
      "Tap the deck to draw. If the drawn card fits, you can play it or pass.",
      "Hit the ONNU! button when you're down to 2 cards on your turn.",
      "See someone on 1 card without a call? Tap Catch! to give them +2.",
    ],
    tips: [
      "Save Wild +4 for when the next player is close to winning.",
      "Change colour to one your opponents seem to be missing.",
    ],
  },
  rummy: {
    goal: "Arrange all 13 cards into valid sequences and sets, then declare.",
    controls: [
      "Draw by tapping the closed deck or the open card.",
      "Tap cards to select them, then Group to make a meld. Groups show if they're valid.",
      "Tap one card then Discard to end your turn, or Declare to finish the game.",
      "Sort arranges your hand by suit automatically.",
    ],
    tips: [
      "Build your pure sequence first. Without it every card counts against you.",
      "Discard high cards (K, Q, J, A) early if they aren't helping.",
      "Watch what others pick from the open pile to guess their melds.",
    ],
    terms: [
      { term: "Pure sequence", meaning: "3+ consecutive cards of one suit, no wild jokers." },
      { term: "Set", meaning: "3–4 cards of the same rank, all different suits." },
      { term: "Wild joker", meaning: "Every card of the joker rank works as any card." },
    ],
  },
};
