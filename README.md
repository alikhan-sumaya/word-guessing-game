# Word Guessing Arena (Multiplayer)

A real-time browser game for 2–8 players. Players can join from separate phones or computers using a room code. The host starts five rounds; each round lasts 60 seconds.

## Requirements
- Node.js 18 or newer
- Internet connection for online hosting

## Run on your computer
1. Install Node.js from https://nodejs.org/
2. Extract this ZIP.
3. Open a terminal in the extracted `word_guessing_multiplayer` folder.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000 in your browser.

## Test with two devices on the same Wi-Fi
Find your computer's local IPv4 address and open `http://YOUR-IP:3000` on the other device. Allow Node.js through your firewall if prompted. Both devices must be on the same Wi-Fi for this local method.

## Put it online so anyone can play
1. Upload the extracted project to a GitHub repository.
2. Create a web service on a Node.js-compatible host such as Render (https://render.com/).
3. Connect the repository. Use build command `npm install` and start command `npm start`.
4. Deploy, then open the public HTTPS URL supplied by the host on both devices.
5. Player 1 creates a room and shares the room code or invite link. Player 2 enters the same code and joins.

Free hosting plans and their sleep/usage limits can change; check the host's current terms.

## Rules
- 2–8 players per room.
- Five rounds, 60 seconds per round.
- Correct letter: 1 point for each matching letter revealed.
- Complete the word using letters: 3 bonus points.
- Correct full-word guess: 5 bonus points.
- Highest score after five rounds wins.

## Notes
- This is a simple learning/demo project. Room state is held in server memory, so restarting the server clears active games.
- For a production version, add persistent storage, rate limits, reconnect handling, and moderation controls.
