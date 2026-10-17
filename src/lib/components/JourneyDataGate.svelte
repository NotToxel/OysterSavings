<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { hasData } from '$lib/stores/stores';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!$hasData) void goto(resolve('/'), { replaceState: true });
  });
</script>

{#if $hasData}
  {@render children()}
{/if}
