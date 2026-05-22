# Oral Exam Simulator

AI-powered oral exam simulator for bioengineering students at UCBM Rome.

**Live:** https://oral-exam-simulator-production.up.railway.app

## Getting Started

### Prerequisites
- Node.js 16+ 
- Docker (optional, for containerization)
- Xai API key (from https://console.x.ai/)

### Setup

1. Clone/extract this project
2. Copy `.env.example` to `.env` and add your Xai API key:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and replace `your_xai_api_key_here` with your actual key

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` in your browser

### Using with Docker

Build the image:
```bash
docker build -t oral-exam-simulator .
```

Run the container:
```bash
docker run -p 3000:3000 -e XAI_API_KEY=your_key_here oral-exam-simulator
```

Or with docker-compose:
```bash
docker compose up
```

## How It Works

1. **Select Subject**: Choose between Anatomy or Physics
2. **Start Exam**: The AI professor will introduce the exam topic
3. **Answer Questions**: Type your answer or use the speech recognition button (🎤)
4. **Get Feedback**: Receive immediate feedback on your answers
5. **Continue**: The professor will ask follow-up questions based on your responses
6. **End Exam**: Click "End Exam" to finish

## Features

- ✅ AI-powered professors with deep knowledge of anatomy and physics
- ✅ Speech recognition for natural oral practice (works in modern browsers)
- ✅ Real-time feedback on answers
- ✅ Contextual follow-up questions
- ✅ Unlimited practice sessions
- ✅ No answer tracking (perfect for practicing without judgment)

## Supported Subjects

- **Anatomy**: Questions on skeletal, muscular, nervous, cardiovascular, respiratory, digestive, and endocrine systems
- **Physics**: Mechanics, thermodynamics, electromagnetism, optics, and biomedical applications

## Browser Compatibility

- Chrome/Edge: Full support including speech recognition
- Firefox: Supported (speech recognition may require additional setup)
- Safari: Supported (speech recognition available on macOS/iOS 14+)

## Tips for Best Results

1. Speak clearly if using speech recognition
2. Try to answer questions in complete sentences
3. Don't worry about perfect answers—this is practice!
4. Use follow-up questions to deepen your understanding
5. Take multiple exams on different topics

## API Endpoints

- `POST /api/exam/start` - Start a new exam session
- `POST /api/exam/question` - Submit answer and get next question
- `GET /api/exam/session/:sessionId` - Get session info
- `DELETE /api/exam/session/:sessionId` - End exam session

## Troubleshooting

**"Speech recognition not supported"**: Use a modern browser like Chrome or Edge

**API key errors**: Ensure your Xai API key is valid and has available credits

**No questions appearing**: Check that the API key is set and the server is running

## License

Created for educational purposes.
