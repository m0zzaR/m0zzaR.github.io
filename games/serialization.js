// serialization.js

/**
 * Function to serialize the current configuration into a string.
 * The format is:
 * numBodies|enableEdgeCollision|enableBodyCollision|randomizePositions|showTrails|mass1,pos1,pos2,vel1,vel2|mass2,pos1,pos2,vel1,vel2|...
 * @returns {string} Serialized configuration string.
 */
function serializeConfiguration() {
    // Gather simulation settings
    const numBodies = parseInt(numBodiesInput.value, 10);
    const enableEdgeCollision = edgeCollisionCheckbox.checked;
    const enableBodyCollision = bodyCollisionCheckbox.checked;
    const randomizePositions = randomizePositionsCheckbox.checked;
    const showTrails = showTrailsCheckbox.checked;

    // Start building the serialized string with simulation settings
    let configString = `${numBodies}|${enableEdgeCollision}|${enableBodyCollision}|${randomizePositions}|${showTrails}`;

    // Append each body's data
    initialBodies.forEach(body => {
        const bodyData = [
            body.mass,
            body.position[0],
            body.position[1],
            body.velocity[0],
            body.velocity[1]
        ];
        // Convert each numerical value to string and join with commas
        const bodyString = bodyData.map(value => value.toString()).join(',');
        // Append to the main config string separated by pipes
        configString += `|${bodyString}`;
    });

    return configString;
}

/**
 * Function to deserialize a configuration string and load it into the simulation.
 * Expects the format:
 * numBodies|enableEdgeCollision|enableBodyCollision|randomizePositions|showTrails|mass1,pos1,pos2,vel1,vel2|mass2,pos1,pos2,vel1,vel2|...
 * @param {string} configString - The serialized configuration string.
 */
function deserializeConfiguration(configString) {
    try {
        const parts = configString.split('|');

        // Ensure there are enough parts for simulation settings
        if (parts.length < 6) { // 5 settings + at least one body
            throw new Error('Configuration string is incomplete.');
        }

        // Parse simulation settings
        const numBodies = parseInt(parts[0], 10);
        if (isNaN(numBodies) || numBodies < 1) {
            throw new Error('Invalid number of bodies.');
        }

        const enableEdgeCollision = parts[1] === 'true';
        const enableBodyCollision = parts[2] === 'true';
        const randomizePositions = parts[3] === 'false';
        const showTrails = parts[4] === 'true';

        // Validate the number of bodies matches the data provided
        if (parts.length !== 5 + numBodies) {
            throw new Error('Number of bodies does not match the configuration.');
        }

        // Update simulation settings in the UI
        numBodiesInput.value = numBodies;
        edgeCollisionCheckbox.checked = enableEdgeCollision;
        bodyCollisionCheckbox.checked = enableBodyCollision;
        randomizePositionsCheckbox.checked = randomizePositions;
        showTrailsCheckbox.checked = showTrails;

        // Regenerate body input fields based on the new number of bodies
        generateBodyInputs();

        // Update each body's data
        for (let i = 0; i < numBodies; i++) {
            const bodyParts = parts[5 + i].split(',');

            if (bodyParts.length !== 5) {
                throw new Error(`Body ${i + 1} has incorrect number of parameters.`);
            }

            const [massStr, pos1Str, pos2Str, vel1Str, vel2Str] = bodyParts;

            const mass = parseFloat(massStr);
            const pos1 = parseFloat(pos1Str);
            const pos2 = parseFloat(pos2Str);
            const vel1 = parseFloat(vel1Str);
            const vel2 = parseFloat(vel2Str);

            // Validate numerical values
            if ([mass, pos1, pos2, vel1, vel2].some(value => isNaN(value))) {
                throw new Error(`Body ${i + 1} has invalid numerical values.`);
            }

            // Update the body object
            const body = initialBodies[i];
            body.mass = mass;
            body.position = [pos1, pos2];
            body.velocity = [vel1, vel2];

            // Update the corresponding input fields in the UI
            const massInput = document.querySelector(`input[name="mass${i}"]`);
            if (massInput) massInput.value = mass;

            const posInputs = document.querySelectorAll(`input[name^="position${i}"]`);
            posInputs.forEach((input, dim) => {
                input.value = body.position[dim];
            });

            const velInputs = document.querySelectorAll(`input[name^="velocity${i}"]`);
            velInputs.forEach((input, dim) => {
                input.value = body.velocity[dim];
            });
        }

        // Select the first body by default
        selectBody(0);

    } catch (error) {
        console.error('Deserialization error:', error);
        alert('Invalid configuration string.');
    }
}
