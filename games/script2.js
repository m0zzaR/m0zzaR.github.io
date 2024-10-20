// Get DOM elements
const numBodiesInput = document.getElementById('numBodies');
const bodiesContainer = document.getElementById('bodies-container');
const simulationForm = document.getElementById('simulation-form');
const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

// New DOM elements for checkboxes
const edgeCollisionCheckbox = document.getElementById('edgeCollision');
const bodyCollisionCheckbox = document.getElementById('bodyCollision');

// New DOM elements for buttons
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');

// Constants
const G = 1; // Gravitational constant (normalized)
const timeStep = 0.01; // Time step for the simulation

// Variables
let bodies = [];
let initialBodies = [];
let numDimensions = 2; // Default to 2D
let animationId;
let colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33A6', '#33FFF6'];
let enableEdgeCollision = false;
let enableBodyCollision = false;
let selectedBodyIndex = null;

// Define simulation boundaries (initialized later)
let simulationBounds = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0
};

// Canvas dimensions and scaling
let scale = 30; // Adjust as needed
function resizeCanvas() {
    // Set canvas dimensions based on the CSS size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Update simulation boundaries to match the visible canvas area
    simulationBounds = {
        minX: -canvas.width / (2 * scale),
        maxX: canvas.width / (2 * scale),
        minY: -canvas.height / (2 * scale),
        maxY: canvas.height / (2 * scale)
    };

    // Redraw bodies after resizing
    drawInitialBodies();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Event listeners
numBodiesInput.addEventListener('change', () => {
    generateBodyInputs();
    selectBody(0); // Select the first body by default
});
simulationForm.addEventListener('submit', startSimulation);
stopButton.addEventListener('click', stopSimulation);

// Generate initial body inputs
generateBodyInputs();
selectBody(0); // Select the first body by default

// Function to generate input fields for bodies
function generateBodyInputs() {
    bodiesContainer.innerHTML = '';
    initialBodies = [];
    const numBodies = parseInt(numBodiesInput.value);

    for (let i = 0; i < numBodies; i++) {
        const bodyDiv = document.createElement('div');
        bodyDiv.classList.add('body-input');
        bodyDiv.dataset.bodyIndex = i;

        // Assign color to the body heading and input fields
        const bodyColor = colors[i % colors.length];

        bodyDiv.innerHTML = `
            <h3 style="color: ${bodyColor}">Body ${i + 1}</h3>

            <div class="input-group">
                <label style="color: ${bodyColor}">Mass:</label>
                <input type="number" name="mass${i}" step="any" required style="border-color: ${bodyColor};" value="1">
            </div>

            <div class="input-group">
                <label style="color: ${bodyColor}">Position:</label>
                ${generateDimensionInputs(`position${i}`, bodyColor)}
            </div>

            <div class="input-group">
                <label style="color: ${bodyColor}">Velocity:</label>
                ${generateDimensionInputs(`velocity${i}`, bodyColor)}
            </div>
        `;

        bodiesContainer.appendChild(bodyDiv);

        // Event listener for selecting a body
        bodyDiv.addEventListener('click', () => selectBody(i));

        // Initialize body data
        const position = new Array(numDimensions).fill(0);
        const velocity = new Array(numDimensions).fill(0);
        const mass = 1; // Default mass
        const body = {
            mass: mass,
            position: position,
            velocity: velocity,
            acceleration: new Array(numDimensions).fill(0),
            trail: [],
            color: bodyColor,
            radius: 5 / scale // Adjusted radius for simulation units
        };
        initialBodies.push(body);

        // Event listeners for input changes
        const massInput = bodyDiv.querySelector(`input[name="mass${i}"]`);
        massInput.addEventListener('input', () => {
            body.mass = parseFloat(massInput.value) || 0;
        });

        for (let d = 0; d < numDimensions; d++) {
            const posInput = bodyDiv.querySelector(`input[name="position${i}${d}"]`);
            posInput.addEventListener('input', () => {
                body.position[d] = parseFloat(posInput.value) || 0;
                drawInitialBodies();
            });

            const velInput = bodyDiv.querySelector(`input[name="velocity${i}${d}"]`);
            velInput.addEventListener('input', () => {
                body.velocity[d] = parseFloat(velInput.value) || 0;
            });
        }
    }

    drawInitialBodies();
}

// Modify generateDimensionInputs to accept color
function generateDimensionInputs(namePrefix, color) {
    let inputs = '';
    for (let d = 0; d < numDimensions; d++) {
        inputs += `<input type="number" class="dimension-input" name="${namePrefix}${d}" step="any" required placeholder="Component ${d + 1}" style="border-color: ${color};" value="0"> `;
    }
    return inputs;
}

// Function to select a body
function selectBody(index) {
    selectedBodyIndex = index;

    // Remove 'selected' class from all body inputs
    const bodyInputs = document.querySelectorAll('.body-input');
    bodyInputs.forEach((input) => {
        input.classList.remove('selected');
    });

    // Add 'selected' class to the selected body input
    const selectedBodyDiv = document.querySelector(`.body-input[data-body-index="${index}"]`);
    selectedBodyDiv.classList.add('selected');
}

// Event listener for canvas clicks
canvas.addEventListener('click', (event) => {
    if (selectedBodyIndex === null) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvas.width / 2;
    const y = event.clientY - rect.top - canvas.height / 2;

    const simX = x / scale;
    const simY = y / scale;

    const body = initialBodies[selectedBodyIndex];
    body.position[0] = simX;
    body.position[1] = simY;

    // Update position inputs
    const posInputs = document.querySelectorAll(`input[name^="position${selectedBodyIndex}"]`);
    posInputs[0].value = simX.toFixed(2);
    posInputs[1].value = simY.toFixed(2);

    drawInitialBodies();
});

// Function to draw initial bodies
function drawInitialBodies() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale and translate coordinates
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

    for (const body of initialBodies) {
        const x = offsetX + body.position[0] * scale;
        const y = offsetY + body.position[1] * scale;
        ctx.beginPath();
        ctx.arc(x, y, body.radius * scale, 0, 2 * Math.PI);
        ctx.fillStyle = body.color;
        ctx.fill();
    }
}

// Function to start the simulation
function startSimulation(event) {
    event.preventDefault();

    // Reset bodies array
    bodies = [];

    const formData = new FormData(simulationForm);
    const numBodies = parseInt(numBodiesInput.value);

    // Get collision options
    enableEdgeCollision = edgeCollisionCheckbox.checked;
    enableBodyCollision = bodyCollisionCheckbox.checked;

    // Collect data for each body
    for (let i = 0; i < numBodies; i++) {
        const mass = parseFloat(formData.get(`mass${i}`));

        // Get position and velocity components
        let position = [];
        let velocity = [];

        for (let d = 0; d < numDimensions; d++) {
            const posComponent = parseFloat(formData.get(`position${i}${d}`));
            const velComponent = parseFloat(formData.get(`velocity${i}${d}`));
            position.push(posComponent);
            velocity.push(velComponent);
        }

        // Check for duplicate positions
        if (positionExists(position)) {
            alert(`Body ${i + 1} has the same position as another body. Please enter a different position.`);
            return;
        }

        // Assign color to the body using the same logic
        const bodyColor = colors[i % colors.length];

        bodies.push({
            mass: mass,
            position: position,
            velocity: velocity,
            acceleration: new Array(numDimensions).fill(0),
            trail: [], // To store positions for drawing trails
            color: bodyColor,
            radius: 5 / scale // Adjusted radius for simulation units
        });
    }

    // Disable form inputs and start button
    simulationForm.querySelectorAll('input, button').forEach((elem) => {
        elem.disabled = true;
    });
    stopButton.disabled = false;

    // Start the animation loop
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    animate();
}

// Function to stop the simulation
function stopSimulation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Re-enable form inputs and start button
    simulationForm.querySelectorAll('input, button').forEach((elem) => {
        elem.disabled = false;
    });
    stopButton.disabled = true;

    // Clear the canvas and redraw initial bodies
    drawInitialBodies();
}

// Function to check if a position is already occupied
function positionExists(position, tol = 1e-8) {
    for (const body of bodies) {
        let samePosition = true;
        for (let i = 0; i < numDimensions; i++) {
            if (Math.abs(body.position[i] - position[i]) > tol) {
                samePosition = false;
                break;
            }
        }
        if (samePosition) {
            return true;
        }
    }
    return false;
}

// Function to update positions and velocities
function updateBodies() {
    const numBodies = bodies.length;

    // Reset accelerations
    for (const body of bodies) {
        body.acceleration.fill(0);
    }

    // Calculate gravitational forces
    for (let i = 0; i < numBodies; i++) {
        for (let j = i + 1; j < numBodies; j++) {
            const bodyA = bodies[i];
            const bodyB = bodies[j];

            const diff = [];
            let distanceSquared = 0;

            for (let d = 0; d < numDimensions; d++) {
                const delta = bodyB.position[d] - bodyA.position[d];
                diff.push(delta);
                distanceSquared += delta * delta;
            }

            const distance = Math.sqrt(distanceSquared) + 1e-2; // Softening parameter

            // Check for body collision
            if (enableBodyCollision && distance < (bodyA.radius + bodyB.radius)) {
                handleBodyCollision(bodyA, bodyB);
                continue; // Skip gravitational force calculation for collided bodies
            }

            const forceMagnitude = (G * bodyA.mass * bodyB.mass) / (distance * distance);

            for (let d = 0; d < numDimensions; d++) {
                const force = (forceMagnitude * diff[d]) / distance;
                bodyA.acceleration[d] += force / bodyA.mass;
                bodyB.acceleration[d] -= force / bodyB.mass; // Newton's third law
            }
        }
    }

    // Update velocities and positions
    for (const body of bodies) {
        for (let d = 0; d < numDimensions; d++) {
            body.velocity[d] += body.acceleration[d] * timeStep;
            body.position[d] += body.velocity[d] * timeStep;

            // Handle edge collision
            if (enableEdgeCollision) {
                let pos = body.position[d];
                let minBoundary, maxBoundary;

                if (d === 0) {
                    // X-dimension (horizontal)
                    minBoundary = simulationBounds.minX + body.radius;
                    maxBoundary = simulationBounds.maxX - body.radius;
                } else if (d === 1) {
                    // Y-dimension (vertical)
                    minBoundary = simulationBounds.minY + body.radius;
                    maxBoundary = simulationBounds.maxY - body.radius;
                }

                if (pos < minBoundary) {
                    body.position[d] = minBoundary;
                    body.velocity[d] *= -1; // Reverse velocity component
                } else if (pos > maxBoundary) {
                    body.position[d] = maxBoundary;
                    body.velocity[d] *= -1; // Reverse velocity component
                }
            }
        }
        // Store position for trail
        body.trail.push([...body.position]);
        if (body.trail.length > 500) {
            body.trail.shift();
        }
    }
}

// Function to handle body collisions
function handleBodyCollision(bodyA, bodyB) {
    const numDimensions = bodyA.position.length;

    // Compute the normal vector (from bodyA to bodyB)
    const normal = [];
    let distanceSquared = 0;
    for (let d = 0; d < numDimensions; d++) {
        const delta = bodyB.position[d] - bodyA.position[d];
        normal.push(delta);
        distanceSquared += delta * delta;
    }
    const distance = Math.sqrt(distanceSquared);

    // Normalize the normal vector
    for (let d = 0; d < numDimensions; d++) {
        normal[d] /= distance;
    }

    // Compute relative velocity
    const relativeVelocity = [];
    for (let d = 0; d < numDimensions; d++) {
        relativeVelocity.push(bodyA.velocity[d] - bodyB.velocity[d]);
    }

    // Compute velocity along the normal
    let velocityAlongNormal = 0;
    for (let d = 0; d < numDimensions; d++) {
        velocityAlongNormal += relativeVelocity[d] * normal[d];
    }

    // Do not resolve if velocities are separating
    if (velocityAlongNormal > 0) return;

    // Compute restitution (elastic collision, e = 1)
    const e = 1;

    // Compute impulse scalar
    const impulseScalar = -(1 + e) * velocityAlongNormal / (1 / bodyA.mass + 1 / bodyB.mass);

    // Apply impulse to bodies
    for (let d = 0; d < numDimensions; d++) {
        const impulse = impulseScalar * normal[d];
        bodyA.velocity[d] += impulse / bodyA.mass;
        bodyB.velocity[d] -= impulse / bodyB.mass;
    }
}

// Function to draw the simulation
function drawBodies() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale and translate coordinates
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

    for (const body of bodies) {
        // Draw trail
        if (body.trail.length > 1) {
            ctx.beginPath();
            for (let i = 0; i < body.trail.length; i++) {
                const pos = body.trail[i];
                const x = offsetX + pos[0] * scale;
                const y = offsetY + pos[1] * scale;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.strokeStyle = body.color;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw body
        const x = offsetX + body.position[0] * scale;
        const y = offsetY + body.position[1] * scale;
        ctx.beginPath();
        ctx.arc(x, y, body.radius * scale, 0, 2 * Math.PI);
        ctx.fillStyle = body.color;
        ctx.fill();
    }
}

// Animation loop
function animate() {
    updateBodies();
    drawBodies();
    animationId = requestAnimationFrame(animate);
}
