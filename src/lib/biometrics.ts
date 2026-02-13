/**
 * Utility for handling real biometric authentication using the WebAuthn API.
 */

export async function checkBiometricAvailability(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    // This can throw if a Permissions Policy blocks it
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (e) {
    console.warn("Biometric availability check failed:", e);
    return false;
  }
}

export async function verifyWithBiometrics(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new Error("Biometric authentication is not supported by this browser.");
  }

  // Determine valid RP ID (must be a valid domain or localhost)
  const hostname = window.location.hostname;

  try {
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!isAvailable) {
      throw new Error("Biometric hardware is not available or not configured on this device.");
    }
  } catch (e: any) {
    if (e.name === 'NotAllowedError' || e.message.includes('Permissions Policy')) {
      throw new Error("Environment Restriction: Biometric hardware is blocked by this site's security policy (Permissions Policy).");
    }
    throw e;
  }

  // Create a challenge for the platform authenticator
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const options: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: "Guardrail",
        id: hostname,
      },
      user: {
        id: userId,
        name: "guardrail-user",
        displayName: "Guardrail Secure Node",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60000,
    },
  };

  try {
    // This triggers the native OS/Hardware prompt (FaceID, TouchID, etc.)
    const credential = await navigator.credentials.create(options);
    return !!credential;
  } catch (error: any) {
    console.error("Biometric Error:", error);
    
    if (error.name === 'NotAllowedError') {
      if (error.message.includes('Permissions Policy') || error.message.includes('feature is not enabled')) {
        throw new Error("Environment Restriction: Biometric hardware is blocked by this site's security policy (Permissions Policy).");
      }
      throw new Error("Verification was cancelled or timed out.");
    }
    
    if (error.name === 'SecurityError') {
      throw new Error("Security error: Ensure you are using HTTPS and a valid domain.");
    }
    
    throw new Error(error.message || "An unexpected error occurred during biometric verification.");
  }
}
