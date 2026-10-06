# Camp Snallygaster – Game Design

## Core Premise

**Year:** Summer 1993

**Setting:** A large American summer camp surrounded by dense forest.

**Situation:** An emergency alarm occurred. Campers followed training and hid everywhere. Now counselors must find and rescue all seven hidden campers and return them to the evacuation bus before a mysterious creature—the Snallygaster—catches them.

## Primary Objective

- Find 7 hidden campers scattered throughout the camp
- Get each camper to follow or carry them back to the bus
- All 7 must reach the bus extraction zone
- Counselors must return to the bus for extraction
- Avoid or outrun the Snallygaster

## Player Role

Players are **summer-camp counselors** (1–6 per session, up to 15 in larger sessions).

### Counselor Attributes
- Health / downed state (can be revived by teammates)
- Stamina (affects sprint speed)
- Flashlight battery (drains over time, rechargeable)
- Inventory (carry one camper, follow multiple)
- Can equip a rare Desert Eagle (server-spawned, ~35% chance per round)

## Core Loop

1. **BUS** → Team spawns at evacuation bus
2. **ENTER CAMP** → Search buildings and outdoor areas
3. **SEARCH** → Open doors, closets, check hiding spots (under beds, behind counters, in pantries, treehouses, etc.)
4. **LISTEN** → Subtle audio cues reveal camper locations
5. **FIND CAMPER** → Discovery via interaction
6. **FOLLOW/CARRY** → Camper follows counselor or is carried
7. **EVADE MONSTER** → Snallygaster hunts, especially when sprinting or using flashlight
8. **RETURN TO BUS** → Get camper safely aboard
9. **REPEAT** → Go back for remaining campers

## Camper Hiding Spots (40+)

**Cabins:**
- Under beds, in closets, under desks, bunk corners

**Dining Hall:**
- Under tables, behind kitchen counter, in pantry, storage rooms

**Bathhouse:**
- Inside stalls, shower corners, laundry closets

**Arts & Crafts:**
- Supply cabinet, under work tables

**Maintenance Shed:**
- Behind crates, shelves, storage lockers

**Outdoor:**
- Treehouse platform, under picnic tables, behind dumpsters, dock/canoe area, fire pit

**Director's Office:**
- Desk drawer (contains rare handgun), filing cabinet, closet

**Trails & Forest:**
- Behind large rocks, log piles, under lookouts

## The Snallygaster

**Monster AI States:**
- **DORMANT:** Early round, inactive (first ~35 seconds)
- **ROAM:** Patrolling the camp
- **INVESTIGATE:** Responding to recent noise
- **STALK:** Aware of a player within ~20m, moving closer
- **CHASE:** Player in close range (~12m), creature at full speed
- **STUNNED:** Hit by handgun, temporary stagger
- **RETREAT:** After attacking, backs away briefly
- **DEAD:** Killed by accumulated gunfire

**Perception:**
- Sprinting players (high noise)
- Flashlight use (visible light)
- Doors opening
- Campers making sound
- Radio pings
- Gunshots (loud and far-reaching)
- Collision impacts (physics noise events)

**Abilities:**
- Cannot pass through walls or closed doors (physical collision)
- Can open doors (pushes them)
- Moves toward noise sources
- Becomes more aggressive as night falls
- Health: ~5 handgun hits to kill

## Environmental Escalation

Round begins at **dusk**, transitions to **full night** (~12 minutes).

- **Dusk (0–4 min):** Monster dormant, good visibility
- **Evening (4–8 min):** Monster begins roaming, ambient light dims
- **Twilight (8–10 min):** Increasing darkness, monster aggressive
- **Night (10–12+ min):** Deep darkness, monster at maximum threat level

Power fails in some buildings, lights flicker, ambiance becomes more hostile.

## Rare Handgun: Desert Eagle

**Spawn Mechanics:**
- ~35% chance per round
- Spawned inside locked/closed director's desk drawer
- Gun is invisible until drawer is opened
- Player must physically discover and pick it up
- Only one per round

**Characteristics:**
- Semi-automatic, large recoil
- 7-round magazine + random 0–7 reserve ammo
- Loud gunshot (monster hears from far away)
- Server-validated hitscan
- 1 hit = monster stagger/stun, multiple hits = monster damage/death

**First-Person Weapon Model:**
- Low-poly metallic finish (original design, no branded assets)
- Recoil animation
- Muzzle flash
- Shell/cartridge (optional)
- Fire rate: ~360ms between shots (semi-auto feel)

**Tactical Depth:**
- Ammunition scarcity = tough decision: use now or save?
- Gunfire reveals shooter location to monster
- Cannot fire while carrying a camper
- Cooldown/ammo prevents spray-and-pray

## Multiplayer Dynamics

**1–6 Counselors per Round**

- Coordination matters (radio pings, callouts)
- Splitting up speeds progress but increases danger
- One downed player can be revived by another (costs time)
- All players downed = round failed

**Radio Communication:**
Pings include:
- FOUND CAMPER
- MONSTER HERE
- NEED HELP
- COME HERE
- RETURNING TO BUS

Pings broadcast to all teammates with position and caller name.

## Failure & Success

**Round Complete:**
- All 7 campers safely on bus
- All surviving counselors back at bus
- Game shows results (time, campers found by whom, monster fate)
- Automatic transition to next round after ~9 seconds

**Round Failed:**
- Every counselor is simultaneously downed
- No revival possible
- Round resets

**Downed Mechanic:**
- Player cannot move, can call for help via radio
- Another counselor within ~2.3m can hold E to revive
- Revive takes ~2 seconds
- Briefly backgrounded players (iPad pause) reconnect to their slot

## Aesthetic & Atmosphere

**Visual Language:**
- Faded 1993 outdoor/camp design
- Sunflower yellows, neon oranges, forest greens, teals
- Fleece patterns, geometric designs
- Hand-painted wooden signs
- CRT monitors, walkie-talkies, corded phones
- No futuristic UI

**Audio Design:**
- Proximity audio: distant footsteps, breathing, branch snaps
- Camper audio: quiet crying, whispering, tapping
- Monster audio: scrapes, strange calls, impacts
- Radio static and pings
- Environmental ambiance (wind, distant campfire)

**Emergent Comedy:**
- Tripping over props
- Accidental noise at terrible times
- Teammates splitting up and reuniting
- Flashlight flickering at wrong moments
- Barely escaping the monster
- Finding a camper hidden in an unexpected spot

## Player Feel

- **With friends:** Chaotic, funny, stressful in bursts
- **Alone:** Isolating and tense
- **Early game:** Cozy exploration
- **Mid game:** Escalating tension
- **Late game:** Desperate extraction runs

**Emotional Arc:**
"This is kind of nice." → "Where is this kid?" → "Did you hear that?" → "TURN OFF YOUR FLASHLIGHT" → "I FOUND ONE!" → "RUN TO THE BUS!" → screaming and laughter
