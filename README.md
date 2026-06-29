# Anticheating

AI-powered online exam proctoring system with real-time monitoring and violation detection.

## Features

### Authentication
- **Student Registration**: Create account with email, name, and optional student ID
- **Secure Login**: JWT-based authentication with MongoDB backend
- **Protected Routes**: Exam pages require authentication
- **User Profile**: View user information and logout

### Exam Monitoring
- **AI-Powered Webcam Monitoring**: Real-time face detection, gaze tracking, and prohibited object detection using TensorFlow.js
- **Audio Monitoring**: Continuous microphone monitoring with loud noise detection (20% threshold)
- **Browser Activity Blocking**: Prevents tab switching, copy-paste, dev tools access, and other suspicious activities
- **Violation Logging**: Comprehensive timestamped violation tracking with real-time alerts
- **Exam Timer**: Configurable countdown timer with auto-submission
- **Fullscreen Enforcement**: Requires fullscreen mode during exam sessions

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **AI/ML**: TensorFlow.js (BlazeFace, COCO-SSD)
- **Routing**: React Router DOM
- **State Management**: TanStack React Query

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- MongoDB database (local or MongoDB Atlas)

### Installation

```bash
# Install dependencies
npm install

# Create .env file (see Environment Variables below)
# Start development server
npm run dev
```

The application will be available at `http://localhost:8080`

### Environment Variables

Create a `.env` file in the root directory:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000/api
```

For production, update this to your backend API URL:
```env
VITE_API_URL=https://api.yourapp.com/api
```

### Build for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── WebcamMonitor.tsx
│   ├── AudioLevelMeter.tsx
│   ├── ViolationLog.tsx
│   ├── ExamTimer.tsx
│   ├── ProtectedRoute.tsx
│   └── ...
├── contexts/        # React contexts
│   └── AuthContext.tsx  # Authentication context
├── hooks/           # Custom React hooks
│   ├── useWebcam.ts
│   ├── useAudioMonitor.ts
│   ├── useBrowserMonitoring.ts
│   └── useAIProctoring.ts
├── lib/             # Utilities and API
│   ├── api.ts       # API client for MongoDB backend
│   └── utils.ts
├── pages/           # Page components
│   ├── Index.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── ExamPage.tsx
│   └── NotFound.tsx
└── assets/          # Static assets
```

## Backend Setup

The frontend expects a MongoDB backend API. See `BACKEND_API.md` for complete API documentation.

### Quick Backend Requirements

1. **Authentication Endpoints:**
   - `POST /api/auth/register` - Student registration
   - `POST /api/auth/login` - User login
   - `GET /api/auth/me` - Get current user (requires auth token)
   - `POST /api/auth/logout` - Logout

2. **MongoDB Collections:**
   - `users` - Store student information
   - `exams` - Store exam submissions (future)

3. **JWT Authentication:**
   - Token stored in `localStorage` as `auth_token`
   - Token sent in `Authorization: Bearer <token>` header

See `BACKEND_API.md` for detailed API specifications and MongoDB schema examples.

## Security Features

### Webcam AI Detection
- Face presence detection
- Multiple face detection
- Gaze direction tracking
- Prohibited object detection (cell phones, books, etc.)
- Face obscurity detection

### Audio Monitoring
- Real-time audio level tracking
- Loud noise detection with configurable thresholds

### Browser Activity Blocking
- Tab switching detection
- Copy/paste blocking
- Right-click blocking
- Dev tools shortcut blocking
- Window minimize detection
- Fullscreen requirement enforcement
- Screenshot attempt blocking

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## License

This project is private and proprietary.
