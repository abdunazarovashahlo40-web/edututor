import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { post } from '../../services/api';

/** Qurilmada barmoq izi / Face ID (platform authenticator) bormi */
export async function biometricAvailable() {
  try {
    if (!browserSupportsWebAuthn()) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometric() {
  const options = await post('/auth/app-lock/biometric/register-options');
  const response = await startRegistration({ optionsJSON: options });
  return post('/auth/app-lock/biometric/register-verify', { response });
}

export async function unlockWithBiometric() {
  const options = await post('/auth/app-lock/biometric/unlock-options');
  const response = await startAuthentication({ optionsJSON: options });
  return post('/auth/app-lock/biometric/unlock-verify', { response });
}
