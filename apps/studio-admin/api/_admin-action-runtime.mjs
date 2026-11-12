import {
  createFirestoreAdminActionStoreProvider,
} from './_firestore-admin-actions.mjs';

const defaultProvider =
  createFirestoreAdminActionStoreProvider();

let runtimeProvider = defaultProvider;

export function adminActionRuntimeProvider() {
  return runtimeProvider;
}

export function setAdminActionRuntimeProviderForTests(
  provider,
) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error(
      'Test-only Admin action runtime override',
    );
  }

  runtimeProvider =
    provider ?? defaultProvider;
}
