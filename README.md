# MuscleQuest

MuscleQuest is a mobile workout tracker app built to help users plan, track, and optimize their workout routines. With local-first data storage, MuscleQuest ensures smooth performance without requiring a constant internet connection. The app provides an intuitive interface to manage workout plans, log exercises, and track progress over time.

## Features

- **Create and Manage Workout Plans**: Users can build custom workout plans and easily switch between different routines.
- **Track Active Workouts**: Start workouts from the home screen and log weight, reps, and sets as you progress through each exercise.
- **Rest Timer**: An automatic rest timer between sets ensures users stay on track without needing external timers.
- **Workout History & Stats**: View detailed stats of completed workouts, including total sets, time spent, and body parts targeted.
- **Settings Customization**: Adjust app settings such as units (kg/lbs), weight increment preferences, and weekly goals.
- **Offline-First Architecture**: All data is stored locally on the user's device, ensuring quick access and reliability even without an internet connection.
- **Firebase Authentication**: Secure login with Firebase.

## Screenshots

> Screenshot coming soon

## Tech Stack

- **Frontend**: [React Native](https://reactnative.dev/), [Expo](https://expo.dev/)
- **State Management**: [Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction)
- **Data Management**: [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Tanstack Query](https://tanstack.com/query/latest)
- **Backend**: [Firebase Authentication](https://firebase.google.com/products/auth)
- **UI Library**: [React Native Paper](https://reactnativepaper.com/)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/isotronic/MuscleQuest.git
cd MuscleQuest
```

2. Install dependencies:

```bash
npm install
```

3. Set up Firebase:

   - Create a project on [Firebase](https://console.firebase.google.com/).
   - Copy your google-services.json into the project folder and add it to an `.env` file.

4. Run the app on an iOS or Android emulator:

```bash
npx expo start
```

## User Data Database Structure

### Plan

```ts
{
  plan_id: number;
  name: string;
  exercises: Exercise[];
  is_active: 0 | 1;
}
```

### Exercise

```ts
{
  exercise_id: number;
  name: string;
  image: string[];
  local_animated_uri: string;
  animated_url: string;
  equipment: string;
  body_part: string;
  target_muscle: string;
  secondary_muscles: string[];
  description: string;
}
```

### Completed Workout

```ts
{
  workout_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercises: {
    exercise_id: number;
    exercise_name: string;
    sets: {
      set_number: number;
      weight: number;
      reps: number;
    }
    [];
  }
  [];
}
```

## Contributing

You are most welcome to contribute to MuscleQuest! To contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a new Pull Request

## Contact

For any inquiries or suggestions, feel free to reach out:

- **Email**: <joseph@musclequest.app>
- **GitHub**: [isotronic](https://github.com/isotronic)
