<script>
  import { auth } from '$lib/stores.js';
  import Login from '$lib/components/Login.svelte';
  import PrinterStatus from '$lib/components/PrinterStatus.svelte';
  import PrinterManagement from '$lib/components/PrinterManagement.svelte'; // Assuming this will be created

  let isAuthenticated = false;
  let isLoadingAuth = true;

  auth.subscribe(value => {
    isAuthenticated = value.isAuthenticated;
    isLoadingAuth = value.isLoading;
  });

</script>

<div class="container mx-auto p-4">
  {#if isLoadingAuth}
    <div class="flex justify-center items-center p-8">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      <p class="ml-3 text-lg">Loading authentication status...</p>
    </div>
  {:else if isAuthenticated}
    <div>
      <!-- Sections to show when authenticated -->
      <PrinterStatus />
      <PrinterManagement />
      <!-- TODO: Add a logout button somewhere accessible -->
       <div class="mt-8 flex justify-center">
        <button
          on:click={async () => {
            await fetch('/api/logout', { method: 'POST' });
            auth.set({ isAuthenticated: false, email: null, isLoading: false, needsVerification: false, tfaKey: null });
          }}
          class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md transition duration-150 ease-in-out"
        >
          Logout
        </button>
      </div>
    </div>
  {:else}
    <!-- Login Section -->
    <Login />
  {/if}
</div>

<style lang="postcss">
  /* Page specific styles can go here if needed, or use Tailwind classes directly */
  /* Example: ensure container takes available space */
  .container {
    width: 100%;
  }
</style>
