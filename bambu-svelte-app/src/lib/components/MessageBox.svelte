<script>
  import { message, hideMessage } from '$lib/stores.js';

  let currentMessage = '';
  let currentType = 'info';
  let isVisible = false;

  message.subscribe(value => {
    currentMessage = value.text;
    currentType = value.type;
    isVisible = value.visible;
  });

  const typeClasses = {
    info: 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-700 dark:border-blue-500 dark:text-blue-100',
    success: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-700 dark:border-green-500 dark:text-green-100',
    error: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-700 dark:border-red-500 dark:text-red-100',
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-700 dark:border-yellow-500 dark:text-yellow-100',
  };

  $: boxClass = `border-l-4 p-4 fixed top-4 right-4 z-50 shadow-lg rounded-md ${typeClasses[currentType] || typeClasses.info}`;

</script>

{#if isVisible && currentMessage}
  <div role="alert" class="{boxClass} transition-opacity duration-300 ease-in-out {isVisible ? 'opacity-100' : 'opacity-0'}" on:click={hideMessage}>
    <p class="font-bold capitalize">{currentType}</p>
    <p>{@html currentMessage}</p> <!-- Use @html if messages can contain simple HTML, otherwise just {currentMessage} -->
     <button
        on:click|stopPropagation={hideMessage}
        class="absolute top-1 right-1 text-lg font-bold leading-none"
        aria-label="Close message"
    >&times;</button>
  </div>
{/if}

<style>
  /* Add any specific styles if Tailwind isn't covering everything */
  /* Ensure the message box is noticeable but not obstructive */
</style>
