<script lang="ts">
  import { onMount } from 'svelte';

  type Point = [number, number];
  type Route = { name: 'blue' | 'purple' | 'orange' | 'teal' | 'red'; d: string; train: boolean };
  type Station = { x: number; y: number; interchange?: boolean };

  let backdrop: HTMLDivElement;
  let size = $state({ width: 1440, height: 680 });
  let ready = $state(false);
  let running = $state(false);

  function buildMap(width: number, height: number) {
    const compact = width <= 760;
    const xLeft = Math.round(width * (compact ? 0.17 : 0.13));
    const xRight = Math.round(width * (compact ? 0.83 : 0.79));
    const yRail = Math.round(height * (compact ? 0.84 : 0.78));
    const routes: Route[] = [];
    const stations: Station[] = [];
    const path = (points: Point[]) => points.map(([x, y], index) =>
      (index ? 'L' : 'M') + Math.round(x) + ' ' + Math.round(y)
    ).join(' ');
    const add = (name: Route['name'], points: Point[], train = false) => routes.push({ name, d: path(points), train });
    const stop = (x: number, y: number, interchange = false) => stations.push({ x: Math.round(x), y: Math.round(y), interchange });

    if (compact) {
      const yBlue = Math.round(height * 0.64);
      const yPurple = Math.round(height * 0.61);
      add('blue', [[-20, yBlue], [xLeft - 22, yBlue], [xLeft, yBlue + 22], [xLeft, yRail], [xLeft + 72, yRail]], true);
      add('purple', [[width + 20, yPurple], [xRight + 22, yPurple], [xRight, yPurple + 22], [xRight, yRail], [xRight - 72, yRail]], true);
      add('orange', [[-20, yRail + 43], [xLeft - 43, yRail + 43], [xLeft, yRail], [xRight, yRail], [xRight + 43, yRail + 43], [width + 20, yRail + 43]], true);
      stop(xLeft - 22, yBlue);
      stop(xLeft, yRail, true);
      stop((xLeft + xRight) / 2, yRail);
      stop(xRight, yRail, true);
      stop(xRight + 22, yPurple);
      stop(xRight + 43, yRail + 43);
    } else {
      const xMiddle = Math.round(width * 0.5);
      const yBranch = Math.round(height * 0.53);
      const yRidge = yRail - 62;
      const blueTop = Math.round(width * 0.39);
      const purpleTop = Math.round(width * 0.63);

      // Fixed connections and 45-degree diagonals keep the network schematic.
      add('blue', [[blueTop, -20], [blueTop, 85], [blueTop - 55, 140], [xLeft + 55, 140], [xLeft, 195], [xLeft, yRail], [-20, yRail]], true);
      add('purple', [[purpleTop, -20], [purpleTop, 140], [xRight - 55, 140], [xRight, 195], [xRight, yRail], [width + 20, yRail]], true);
      add('orange', [[-20, yRail], [xLeft, yRail], [xMiddle - 122, yRail], [xMiddle - 60, yRidge], [xMiddle + 60, yRidge], [xMiddle + 122, yRail], [xRight, yRail], [width + 20, yRail]], true);
      add('teal', [[-20, yBranch - 95], [xLeft - 95, yBranch - 95], [xLeft, yBranch], [xLeft + 90, yBranch]]);
      add('red', [[width + 20, yBranch - 95], [xRight + 95, yBranch - 95], [xRight, yBranch], [xRight - 90, yBranch]]);

      stop(xLeft, 195);
      stop(xLeft, Math.round((195 + yBranch) / 2));
      stop(xLeft, yBranch, true);
      stop(xLeft, yRail, true);
      stop(xLeft - 95, yBranch - 95);
      stop(blueTop - 55, 140);
      stop(xMiddle - 60, yRidge);
      stop(xMiddle + 60, yRidge);
      stop(xRight, 195);
      stop(xRight, yBranch, true);
      stop(xRight, yRail, true);
      stop(xRight + 95, yBranch - 95);
      stop(purpleTop, 140);
    }

    return { routes, stations };
  }

  let map = $derived(buildMap(size.width, size.height));

  function watchVisibility(node: HTMLElement) {
    let inView = false;
    const update = () => { running = inView && !document.hidden; };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(node);
    document.addEventListener('visibilitychange', update);
    return {
      destroy() {
        observer.disconnect();
        document.removeEventListener('visibilitychange', update);
      }
    };
  }

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      size = { width: Math.round(width), height: Math.round(height) };
      ready = true;
    });
    observer.observe(backdrop);
    return () => observer.disconnect();
  });
</script>

<div class="route-backdrop" class:ready class:running bind:this={backdrop} use:watchVisibility aria-hidden="true">
  <div class="route-field">
    <svg viewBox={'0 0 ' + size.width + ' ' + size.height} focusable="false">
      {#each map.routes as route (route.name)}
        <path class={'route route-' + route.name} d={route.d} />
        {#if route.train}
          <path class={'route-trace train-' + route.name} pathLength="100" d={route.d} />
        {/if}
      {/each}
      <g class="stations">
        {#each map.stations as station}
          <circle class:interchange={station.interchange} cx={station.x} cy={station.y} r={station.interchange ? 9 : 6} />
        {/each}
      </g>
    </svg>
  </div>
</div>

<style>
  .route-backdrop {
    position: absolute;
    z-index: 0;
    top: 0;
    left: 50%;
    width: 100vw;
    height: min(680px, 76vh);
    transform: translateX(-50%);
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    transition: opacity 400ms ease-out;
    mask-image: linear-gradient(to bottom, black 0%, black 72%, transparent 100%);
  }

  .route-backdrop.ready { opacity: 0.7; }

  .route-field {
    width: 100%;
    height: 100%;
    mask-image: radial-gradient(ellipse 80% 45% at 50% 22%, transparent 65%, black 100%);
  }

  svg { display: block; width: 100%; height: 100%; }

  .route {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .route-blue { stroke: rgba(0, 159, 227, 0.36); }
  .route-purple { stroke: rgba(142, 101, 175, 0.36); }
  .route-orange { stroke: rgba(231, 113, 13, 0.32); }
  .route-teal { stroke: rgba(0, 162, 160, 0.32); }
  .route-red { stroke: rgba(220, 36, 31, 0.28); }

  .route-trace {
    fill: none;
    stroke-width: 5;
    stroke-linecap: round;
    stroke-dasharray: 1.1 98.9;
    stroke-dashoffset: 100;
    animation: route-travel 19s linear infinite;
    animation-play-state: paused;
  }

  .train-blue { stroke: rgba(126, 216, 248, 0.92); }
  .train-purple { stroke: rgba(202, 165, 229, 0.9); animation-duration: 23s; animation-delay: -8s; }
  .train-orange { stroke: rgba(255, 184, 120, 0.88); animation-duration: 27s; animation-delay: -16s; }
  .running .route-trace { animation-play-state: running; }

  .stations {
    fill: #0a0e1a;
    stroke: rgba(172, 195, 215, 0.5);
    stroke-width: 2;
  }

  .interchange {
    fill: #172134;
    stroke: rgba(195, 211, 226, 0.6);
    stroke-width: 3;
  }

  @keyframes route-travel { to { stroke-dashoffset: 0; } }

  @media (max-width: 760px) {
    .route-backdrop {
      height: 540px;
      mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);
    }
    .route-backdrop.ready { opacity: 0.5; }
    .route-field { mask-image: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .route-backdrop { transition: none; }
    .route-trace { display: none; }
  }
</style>
