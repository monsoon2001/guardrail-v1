# **App Name**: Guardrail Auth

## Core Features:

- User Authentication: Enable users to securely sign up and log in via email and password.
- Auth State Listener: Dynamically manage navigation flow, showing authenticated users the main app and unauthenticated users the login screen.
- Unique Guardrail ID Generation: Automatically generate a unique, 6-character alphanumeric 'Guardrail ID' for new users upon successful registration.
- Guardrail ID Uniqueness Check: Before saving, verify that the newly generated 'Guardrail ID' does not already exist in the database to prevent collisions.
- User Profile Persistence: Store the user's profile and their unique 'Guardrail ID' in a 'users' collection within Firestore, keyed by their Firebase UID.
- Guardrail ID Display: Briefly show the newly created 'Guardrail ID' to the user after a successful sign-up.

## Style Guidelines:

- The visual design will adopt a light color scheme, reflecting a clean, professional, and secure aesthetic. The primary color will be a confident and professional blue (#478CD1). The background will be a very light, desaturated blue-gray (#EFF2F5), ensuring clarity and focus. An accent color of a rich purple-blue (#3333CC) will be used to highlight important elements and actions.
- A single font, 'Inter' (sans-serif), will be used for all text elements. Its modern, objective, and neutral appearance contributes to a clean and high-quality feel suitable for an authentication system.
- Simple, crisp line icons will be used for common authentication actions like login, sign-up, and password fields, reinforcing a minimalist and secure interface.
- Authentication forms will be centered with ample padding and clear hierarchy. This provides a focused and intuitive user experience with generous use of whitespace to enhance readability and a clean modern aesthetic.
- Subtle and smooth transitions will be used for screen changes and loading states, along with small micro-interactions for input field focus and button presses, enhancing the 'seamless' user experience.