<script lang="ts">
  import Page from '$lib/components/AnalysisPage.svelte';
  import JourneyDataGate from '$lib/components/JourneyDataGate.svelte';
</script>

<svelte:head><title>Analysis — OysterSavings</title></svelte:head>

<JourneyDataGate>
  <Page />
</JourneyDataGate>
