<script lang="ts">
  import Page from '$lib/components/ComparePage.svelte';
  import JourneyDataGate from '$lib/components/JourneyDataGate.svelte';
</script>

<svelte:head><title>Compare — OysterSavings</title></svelte:head>

<JourneyDataGate>
  <Page />
</JourneyDataGate>
