<script>
  import { auth, showMessage } from '$lib/stores.js';

  let email = '';
  let password = '';
  let verificationCode = '';

  let currentAuthStore;
  auth.subscribe(value => {
    currentAuthStore = value;
  });

  let isLoading = false;

  async function handleLogin() {
    if (!email || !password) {
      showMessage('Please enter email and password.', 'error');
      return;
    }
    isLoading = true;
    showMessage('Logging in...', 'info', 0); // Indefinite message

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (data.success) {
        if (data.needsVerification) {
          auth.update(s => ({ ...s, needsVerification: true, tfaKey: data.tfaKey, email: email /* store email for 2FA step */ }));
          showMessage(data.message || 'Verification code sent. Please enter the code.', 'info');
        } else {
          auth.set({ isAuthenticated: true, email: email, isLoading: false, needsVerification: false, tfaKey: null });
          showMessage(data.message || 'Login successful!', 'success');
        }
      } else {
        showMessage(data.message || 'Login failed.', 'error');
        auth.update(s => ({ ...s, needsVerification: false, tfaKey: null }));
      }
    } catch (error) {
      console.error('Login error:', error);
      showMessage('Network error during login. Please try again.', 'error');
      auth.update(s => ({ ...s, needsVerification: false, tfaKey: null }));
    } finally {
      isLoading = false;
    }
  }

  async function handleVerification() {
    if (!verificationCode) {
      showMessage('Please enter the verification code.', 'error');
      return;
    }
    isLoading = true;
    showMessage('Verifying code...', 'info', 0); // Indefinite message

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentAuthStore.email, // Use stored email
          password: password, // Resend password (original client did this, Bambu API might need it)
          verificationCode: verificationCode,
          tfaKey: currentAuthStore.tfaKey
        }),
      });
      const data = await response.json();

      if (data.success) {
        auth.set({ isAuthenticated: true, email: currentAuthStore.email, isLoading: false, needsVerification: false, tfaKey: null });
        showMessage(data.message || 'Verification successful!', 'success');
      } else {
        showMessage(data.message || 'Verification failed.', 'error');
        // Optionally keep needsVerification true to allow retry, or reset
        // auth.update(s => ({ ...s, needsVerification: true }));
      }
    } catch (error) {
      console.error('Verification error:', error);
      showMessage('Network error during verification. Please try again.', 'error');
    } finally {
      isLoading = false;
    }
  }

  function backToLogin() {
    auth.update(s => ({ ...s, needsVerification: false, tfaKey: null }));
    verificationCode = ''; // Clear code input
  }

  $: loginButtonDisabled = !email || !password || isLoading;
  $: verifyButtonDisabled = !verificationCode || isLoading;

</script>

<div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
  {#if !currentAuthStore?.needsVerification}
    <!-- Login Form -->
    <h2 class="text-2xl font-bold text-center text-gray-700 dark:text-gray-200 mb-6">Login to Bambu Lab Cloud</h2>
    <form on:submit|preventDefault={handleLogin} class="space-y-6">
      <div>
        <label for="emailInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
        <input type="email" id="emailInput" bind:value={email} required
               class="mt-1 block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
               placeholder="you@example.com">
      </div>
      <div>
        <label for="passwordInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
        <input type="password" id="passwordInput" bind:value={password} required
               class="mt-1 block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
               placeholder="••••••••">
      </div>
      <div>
        <button type="submit" disabled={loginButtonDisabled}
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
          {#if isLoading}
            <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
            Processing...
          {:else}
            Login
          {/if}
        </button>
      </div>
    </form>
  {:else}
    <!-- Verification Code Form -->
    <h2 class="text-2xl font-bold text-center text-gray-700 dark:text-gray-200 mb-6">Enter Verification Code</h2>
    <p class="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
      A verification code has been sent to your email address ({currentAuthStore?.email}). Please enter it below.
    </p>
    <form on:submit|preventDefault={handleVerification} class="space-y-6">
      <div>
        <label for="verificationCodeInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Verification Code</label>
        <input type="text" id="verificationCodeInput" bind:value={verificationCode} required
               inputmode="numeric" pattern="\d*"
               class="mt-1 block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
               placeholder="123456">
      </div>
      <div class="flex items-center justify-between space-x-4">
        <button type="button" on:click={backToLogin}
                class="w-1/2 flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition duration-150 ease-in-out">
          Back to Login
        </button>
        <button type="submit" disabled={verifyButtonDisabled}
                class="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
          {#if isLoading}
            <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
            Verifying...
          {:else}
            Verify Code
          {/if}
        </button>
      </div>
    </form>
  {/if}
</div>
