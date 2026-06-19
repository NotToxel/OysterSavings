const fs = require('fs');
const path = require('path');

async function run() {
  const naptanIds = new Set();

  const originalPath = path.resolve(__dirname, '../src/lib/data/stationData.json');
  console.log(`Reading starting list of NaPTANs from: ${originalPath}`);
  if (fs.existsSync(originalPath)) {
    try {
      const content = fs.readFileSync(originalPath, 'utf-8');
      const data = JSON.parse(content);
      for (const key in data) {
        if (data[key] && data[key].naptanId) {
          naptanIds.add(data[key].naptanId);
        }
      }
      console.log(`Extracted ${naptanIds.size} starting unique NaPTAN IDs from stationData.json`);
    } catch (e) {
      console.error('Failed to read starting stationData.json:', e.message);
    }
  } else {
    console.log('No existing stationData.json found, starting with clean TfL modes seed.');
  }

  // Helper function with robust retry and rate-limiting backoff
  async function fetchWithRetry(url) {
    let retries = 5;
    let delay = 3000; // start with 3 seconds
    while (retries > 0) {
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          console.warn(`HTTP 429 (Rate Limit) on ${url}. Retrying in ${delay}ms... (${retries} retries left)`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2;
          continue;
        }
        return res;
      } catch (e) {
        console.error(`Fetch error on ${url}:`, e.message);
        retries--;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return null;
  }

  // Fetch from Tube, DLR, Overground, Elizabeth line mode endpoints (EXCLUDING tram)
  const modes = ['tube', 'dlr', 'overground', 'elizabeth-line'];
  for (const mode of modes) {
    const url = `https://api.tfl.gov.uk/StopPoint/Mode/${mode}`;
    console.log(`Fetching mode [${mode}] stop points from TfL API...`);
    try {
      const res = await fetchWithRetry(url);
      if (res && res.ok) {
        const data = await res.json();
        const stopPoints = data.stopPoints || [];
        for (const stop of stopPoints) {
          const parentId = stop.stationNaptan || stop.id;
          if (parentId && (parentId.startsWith('940G') || parentId.startsWith('910G') || parentId.startsWith('930G'))) {
            if (!parentId.startsWith('940GZZCR')) {
              naptanIds.add(parentId);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to collect from mode [${mode}]:`, e.message);
    }
  }

  console.log(`Total unique NaPTAN IDs to query: ${naptanIds.size}`);

  const idArray = Array.from(naptanIds);
  const batchSize = 20;
  const collectedStopPoints = {};

  // Recursive scanner helper
  function scanStopPoint(stop) {
    if (!stop || !stop.id) return;
    
    let zone = null;
    let altZone = null;
    const zoneProp = stop.additionalProperties && stop.additionalProperties.find(p => p.key === 'Zone');
    if (zoneProp) {
      const zoneValue = zoneProp.value;
      if (zoneValue.includes('/')) {
        const parts = zoneValue.split('/');
        zone = parseInt(parts[0], 10);
        altZone = parseInt(parts[1], 10);
      } else {
        zone = parseInt(zoneValue, 10);
      }
    }

    const children = [];
    if (stop.children) {
      for (const child of stop.children) {
        if (child.id && (child.id.startsWith('940G') || child.id.startsWith('910G') || child.id.startsWith('930G'))) {
          if (child.id.startsWith('940GZZCR')) continue;

          const childModes = new Set();
          if (child.modes) {
            for (const m of child.modes) {
              if (m === 'tube') childModes.add('underground');
              else if (m === 'dlr') childModes.add('dlr');
              else if (m === 'overground') childModes.add('overground');
              else if (m === 'elizabeth-line') childModes.add('elizabeth');
              else if (m === 'national-rail') childModes.add('national_rail');
            }
          }
          
          let childZone = null;
          let childAltZone = null;
          const childZoneProp = child.additionalProperties && child.additionalProperties.find(p => p.key === 'Zone');
          if (childZoneProp) {
            const zoneValue = childZoneProp.value;
            if (zoneValue.includes('/')) {
              const parts = zoneValue.split('/');
              childZone = parseInt(parts[0], 10);
              childAltZone = parseInt(parts[1], 10);
            } else {
              childZone = parseInt(zoneValue, 10);
            }
          }

          children.push({
            id: child.id,
            name: child.commonName,
            modes: Array.from(childModes),
            zone: childZone,
            altZone: childAltZone
          });

          scanStopPoint(child);
        }
      }
    }

    const stopModes = new Set();
    if (stop.modes) {
      for (const m of stop.modes) {
        if (m === 'tube') stopModes.add('underground');
        else if (m === 'dlr') stopModes.add('dlr');
        else if (m === 'overground') stopModes.add('overground');
        else if (m === 'elizabeth-line') stopModes.add('elizabeth');
        else if (m === 'national-rail') stopModes.add('national_rail');
      }
    }

    collectedStopPoints[stop.id] = {
      id: stop.id,
      name: stop.commonName,
      zone,
      altZone,
      modes: Array.from(stopModes),
      childNaptans: children.length > 0 ? children : undefined
    };
  }

  // Query individual ID
  async function queryIndividual(id) {
    const url = `https://api.tfl.gov.uk/StopPoint/${id}`;
    try {
      const res = await fetchWithRetry(url);
      if (res && res.ok) {
        const stop = await res.json();
        scanStopPoint(stop);
      } else {
        console.warn(`Individual query failed for ID ${id}`);
      }
    } catch (e) {
      console.error(`Error querying individual ID ${id}:`, e.message);
    }
  }

  for (let i = 0; i < idArray.length; i += batchSize) {
    const batch = idArray.slice(i, i + batchSize);
    const url = `https://api.tfl.gov.uk/StopPoint/${batch.join(',')}`;
    console.log(`Querying batch [${Math.floor(i / batchSize) + 1} / ${Math.ceil(idArray.length / batchSize)}] of size ${batch.length}...`);

    try {
      const res = await fetchWithRetry(url);
      if (res && res.ok) {
        const data = await res.json();
        const stopPoints = Array.isArray(data) ? data : [data];
        for (const stop of stopPoints) {
          scanStopPoint(stop);
        }
      } else {
        console.warn(`Batch query failed for ${batch.slice(0, 3).join(',')}... Retrying individually...`);
        for (const id of batch) {
          await queryIndividual(id);
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } catch (e) {
      console.error(`Error querying batch:`, e.message);
      for (const id of batch) {
        await queryIndividual(id);
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    await new Promise(r => setTimeout(r, 1000)); // Sleep between batches
  }

  const finalCount = Object.keys(collectedStopPoints).length;
  console.log(`Successfully mapped ${finalCount} unique StopPoints.`);

  if (finalCount > 0) {
    const outputPath = path.resolve(__dirname, 'comprehensive_stations.json');
    fs.writeFileSync(outputPath, JSON.stringify(collectedStopPoints, null, 2), 'utf-8');
    console.log(`Saved comprehensive stations local cache to: ${outputPath}`);
  }
}

run();
