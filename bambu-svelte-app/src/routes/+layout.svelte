<script>
  import "../app.css"; // Assuming app.css for Tailwind is in src/
  import MessageBox from "$lib/components/MessageBox.svelte";
  import { auth } from '$lib/stores.js';
  import { onMount } from 'svelte';

  // Attempt to check auth status on mount by calling a server endpoint
  // This helps sync client-side auth state with server-side session (cookies)
  onMount(async () => {
    try {
      auth.update(current => ({ ...current, isLoading: true }));
      // This endpoint /api/auth/status needs to be created.
      // It should check the cookie and return user status.
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated) {
          auth.set({
            isAuthenticated: true,
            email: data.email,
            isLoading: false,
            needsVerification: false,
            tfaKey: null,
          });
        } else {
          auth.set({
            isAuthenticated: false,
            email: null,
            isLoading: false,
            needsVerification: false,
            tfaKey: null,
          });
        }
      } else {
        // Failed to get status, assume not authenticated
         auth.set({ isAuthenticated: false, email: null, isLoading: false, needsVerification: false, tfaKey: null });
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      // Fallback to not authenticated on error
      auth.set({ isAuthenticated: false, email: null, isLoading: false, needsVerification: false, tfaKey: null });
    }
  });

</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center p-4">
  <header class="w-full max-w-4xl mb-8 text-center">
    <!-- Global header content can go here, e.g., App title -->
     <h1 class="text-3xl font-bold text-sky-600 dark:text-sky-400">Bambu Lab Printer Status</h1>
  </header>

  <main class="w-full max-w-4xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
    <slot />
  </main>

  <MessageBox />

  <footer class="w-full max-w-4xl mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
    <p>Ported to SvelteKit by Jules.</p>
    <!-- Add link to original project or your repo if desired -->
  </footer>
</div>
