import * as utils from '@dcl/ecs-scene-utils'

/*
  IMPORTANT: The tsconfig.json has been configured to include "node_modules/cannon/build/cannon.js"
*/


// Create rocket board
const rocketBoard = new Entity()
rocketBoard.addComponent(new Transform({ position: new Vector3(12, 2, 12), scale: new Vector3(1, 1, 1) }))
rocketBoard.addComponent(new GLTFShape("models/rocketBoard.glb"))

rocketBoard.addComponent(
  new AvatarModifierArea({
    area: { box: new Vector3(1, 3, 1) },
    modifiers: [AvatarModifiers.HIDE_AVATARS],
  })
)

/* Create to show Custom model
  https://docs.decentraland.org/development-guide/utils/#triggers
*/
let triggerBox = new utils.TriggerBoxShape(
	new Vector3(3,3,3), // position?
)

rocketBoard.addComponent(
  new utils.TriggerComponent(
    triggerBox, //shape
    {
      onCameraEnter : () => {
	     log('triggered!')
       //motor.getComponent(Transform).scale = new Vector3(5,5,5)
		 //log(rocketBoard)
         motor.getComponent(Transform).scale.setAll(5)
      }
      onCameraExit: () => {
	     log('out!')
         motor.getComponent(Transform).scale = new Vector3(0,0,0)
      }
    }
  )
);
engine.addEntity(rocketBoard)

const motor = new Entity()
motor.addComponent(new Transform({ scale: new Vector3(5, 5, 5) }))
motor.addComponent(new GLTFShape("models/rocketFlames.glb"))
motor.setParent(rocketBoard)

const rocketFlames = new Entity()
rocketFlames.addComponent(new Transform({ scale: new Vector3(0, 0, 0) }))
rocketFlames.addComponent(new GLTFShape("models/rocketFlames.glb"))
rocketFlames.setParent(rocketBoard)

// Useful vectors
let forwardVector: Vector3 = Vector3.Forward().rotate(Camera.instance.rotation) // Camera's forward vector
let velocityScale: number = 250

// Setup our world
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0) // m/s²
const groundMaterial = new CANNON.Material("groundMaterial")
const groundContactMaterial = new CANNON.ContactMaterial(groundMaterial, groundMaterial, { friction: 0.5, restitution: 0.33 })
world.addContactMaterial(groundContactMaterial)

// Invisible walls
//#region
const wallShape = new CANNON.Box(new CANNON.Vec3(40, 50, 0.5))
const wallNorth = new CANNON.Body({
  mass: 0,
  shape: wallShape,
  position: new CANNON.Vec3(40, 49.5, 80),
})
world.addBody(wallNorth)

const wallSouth = new CANNON.Body({
  mass: 0,
  shape: wallShape,
  position: new CANNON.Vec3(40, 49.5, 0),
})
world.addBody(wallSouth)

const wallEast = new CANNON.Body({
  mass: 0,
  shape: wallShape,
  position: new CANNON.Vec3(80, 49.5, 40),
})
wallEast.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2)
world.addBody(wallEast)

const wallWest = new CANNON.Body({
  mass: 0,
  shape: wallShape,
  position: new CANNON.Vec3(0, 49.5, 40),
})
wallWest.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2)
world.addBody(wallWest)
//#endregion

// Create a ground plane and apply physics material
const groundBody = new CANNON.Body({ mass: 0 })
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2) // Reorient ground plane to be in the y-axis

const groundShape: CANNON.Plane = new CANNON.Plane()
groundBody.addShape(groundShape)
groundBody.material = groundMaterial
world.addBody(groundBody)

const boxMaterial = new CANNON.Material("boxMaterial")
const boxContactMaterial = new CANNON.ContactMaterial(groundMaterial, boxMaterial, { friction: 0.4, restitution: 0 })
world.addContactMaterial(boxContactMaterial)

// Create body to represent the rocket board
let rocketTransform = rocketBoard.getComponent(Transform)

const rocketBody: CANNON.Body = new CANNON.Body({
  mass: 5, // kg
  position: new CANNON.Vec3(rocketTransform.position.x, rocketTransform.position.y, rocketTransform.position.z), // m
  shape: new CANNON.Box(new CANNON.Vec3(2, 0.1, 2)), // m (Create sphere shaped body with a radius of 1)
})
rocketBody.material = boxMaterial // Add bouncy material to box body
world.addBody(rocketBody) // Add body to the world

const fixedTimeStep: number = 1.0 / 60.0 // seconds
const maxSubSteps: number = 3

class physicsUpdateSystem implements ISystem {
  update(dt: number): void {
    // Instruct the world to perform a single step of simulation.
    // It is generally best to keep the time step and iterations fixed.
    world.step(fixedTimeStep, dt, maxSubSteps)

    if (isFKeyPressed) {
      rocketBody.applyForce(
        new CANNON.Vec3(0, 1 * velocityScale, 0), 
        new CANNON.Vec3(rocketBody.position.x, rocketBody.position.y, rocketBody.position.z
      ))
    }

    if (isEKeyPressed) {
      rocketBody.applyForce(
        new CANNON.Vec3(forwardVector.x * velocityScale, 0, forwardVector.z * velocityScale),
        new CANNON.Vec3(rocketBody.position.x, rocketBody.position.y, rocketBody.position.z)
      )
    }

    rocketBody.angularVelocity.setZero() // Prevents the board from rotating in any direction

    // Position the rocket board to match that of the rocket body that's affected by physics
    rocketBoard.getComponent(Transform).position.copyFrom(rocketBody.position)
    forwardVector = Vector3.Forward().rotate(Camera.instance.rotation) // Update forward vector to wherever the player is facing
  }
}

engine.addSystem(new physicsUpdateSystem())

// Controls (workaround to check if a button is pressed or not)
const input = Input.instance
let isEKeyPressed = false
let isFKeyPressed = false

// E Key
input.subscribe("BUTTON_DOWN", ActionButton.PRIMARY, false, () => {
  activateRocketBooster((isEKeyPressed = true))
})
input.subscribe("BUTTON_UP", ActionButton.PRIMARY, false, () => {
  isEKeyPressed = false
  if (!isFKeyPressed) {
    activateRocketBooster(false)
  }
})

// F Key
input.subscribe("BUTTON_DOWN", ActionButton.SECONDARY, false, () => {
  activateRocketBooster((isFKeyPressed = true))
})
input.subscribe("BUTTON_UP", ActionButton.SECONDARY, false, () => {
  isFKeyPressed = false
  if (!isEKeyPressed) {
    activateRocketBooster(false)
  }
})

// Activate booster animation
function activateRocketBooster(isOn: boolean) {
  if (isOn) {
    rocketFlames.getComponent(Transform).scale.setAll(1)
  } else {
    rocketFlames.getComponent(Transform).scale.setAll(0)
  }
}

// Activate Motor
function activateMotor(show: boolean) {
  if (show) {
    motor.getComponent(Transform).scale.setAll(1)
  } else {
    motor.getComponent(Transform).scale.setAll(0)
  }
}
