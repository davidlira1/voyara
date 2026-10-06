# Voyara Product Specification

> **Go farther.**

## 1. Product Overview

Voyara is a fictional commercial space-tourism company operating in a future where passenger space travel is safe, mature, and commonplace.

Voyara offers scheduled sightseeing voyages throughout the solar system. Every voyage departs from and returns to the **Voyara Earth Gateway**.

Passengers do not travel to another planet to stay there. Each Voyara product is a complete round-trip experience with a predetermined trajectory and duration.

Voyara should feel less like a modern space program and more like a future airline.

---

## 2. Brand

**Company:** Voyara  
**Tagline:** Go farther.

Voyara's brand should feel:

- Premium
- Futuristic
- Minimal
- Sophisticated
- Aspirational
- Technologically mature

The product should avoid overly theatrical science-fiction aesthetics. Within Voyara's world, spaceflight is no longer experimental or extraordinary technology—it is established transportation and tourism.

---

## 3. Product Principles

### 3.1 Voyara is a real platform first

The core Voyara platform must function independently of AI.

Customers, voyages, flights, spacecraft, availability, reservations, and pricing belong to Voyara's backend services.

Nova is a client of those services.

### 3.2 Nova interprets intent. Voyara determines truth.

This is the primary architectural rule of the project.

Nova may understand what a customer means, conduct a conversation, ask clarifying questions, and decide which Voyara tools to use.

Nova must not invent operational information.

Information such as:

- Flight schedules
- Prices
- Availability
- Spacecraft assignments
- Reservation status
- Accommodation availability

must originate from Voyara services.

### 3.3 Keep the initial travel model simple

V1 does not include:

- Planetary stays
- Multi-city travel
- Connecting flights
- Training
- Medical clearance
- Real payment processing
- Multiple gateways
- Complex baggage or boarding rules

These concepts may be introduced later only if they improve the product.

---

# 4. Voyages

A **Voyage** is a reusable Voyara product or experience.

A voyage describes where the spacecraft travels, what passengers experience, its typical duration, and its base fare.

A voyage is not a scheduled flight.

## Voyage Catalog

| Code | Voyage | Experience | Duration | Base Fare |
|---|---|---|---:|---:|
| ORB-01 | Earthlight | Low Earth orbit with panoramic Earth views | 4 hours | $1,200 |
| ORB-02 | Blue Horizon | High Earth orbit emphasizing full-Earth views | 8 hours | $2,400 |
| ORB-03 | Polar Passage | Polar orbit passing over both poles | 10 hours | $3,100 |
| ORB-04 | Lunar Arc | Circumlunar voyage around the far side of the Moon | 18 hours | $4,800 |
| ORB-05 | Solar Passage | Inner-system voyage optimized for solar observation | 24 hours | $6,500 |
| ORB-06 | Aphrodite | Close Venus flyby | 30 hours | $9,500 |
| ORB-07 | Ares | Mars flyby with extended observation window | 40 hours | $12,500 |
| ORB-08 | Europa Passage | Jupiter-system voyage featuring Europa and Jupiter | 72 hours | $19,000 |
| ORB-09 | Titan Passage | Saturn-system voyage featuring Saturn's rings and Titan | 96 hours | $24,000 |
| ORB-10 | Grand Tour | Voyara's flagship multi-planet deep-space experience | 7 days | $38,000 |

Base fares represent the Voyager-class fare per passenger.

The universe assumes fictional advanced propulsion technology capable of supporting these travel times.

Scientific accuracy of propulsion is not a requirement. Internal product consistency is.

---

# 5. Earth Gateway

All Voyara flights depart from and return to:

**Voyara Earth Gateway**

V1 contains only one gateway.

Therefore every flight follows the conceptual pattern:

Voyara Earth Gateway → Voyage Trajectory → Voyara Earth Gateway

Additional gateways may be introduced in later versions.

---

# 6. Spacecraft

Voyara operates four spacecraft families.

A spacecraft family defines general capabilities and accommodation capacity.

Individual spacecraft belong to one family.

## 6.1 Meridian

Short-range orbital spacecraft.

**Capacity:** 72 passengers

- Voyager: 48
- Voyager+: 24
- Celestial: unavailable

Primary voyages:

- Earthlight
- Blue Horizon
- Polar Passage

Initial fleet:

- Meridian-01
- Meridian-02
- Meridian-03
- Meridian-04

---

## 6.2 Horizon

Medium-range passenger spacecraft.

**Capacity:** 60 passengers

- Voyager: 36
- Voyager+: 16
- Celestial: 8

Primary voyages:

- Lunar Arc
- Solar Passage

Initial fleet:

- Horizon-01
- Horizon-02
- Horizon-03

---

## 6.3 Odyssey

Interplanetary passenger spacecraft.

**Capacity:** 48 passengers

- Voyager: 24
- Voyager+: 16
- Celestial: 8

Primary voyages:

- Aphrodite
- Ares

Initial fleet:

- Odyssey-01
- Odyssey-02
- Odyssey-03

---

## 6.4 Atlas

Long-range deep-space passenger spacecraft.

**Capacity:** 36 passengers

- Voyager: 16
- Voyager+: 12
- Celestial: 8

Primary voyages:

- Europa Passage
- Titan Passage
- Grand Tour

Initial fleet:

- Atlas-01
- Atlas-02

---

# 7. Travel Classes

Voyara offers three accommodation classes.

## Voyager

Standard Voyara passenger accommodation.

**Fare multiplier:** 1.0× voyage base fare.

---

## Voyager+

Premium accommodation with increased personal space, upgraded service, and improved observation access.

**Fare multiplier:** 1.4× voyage base fare.

---

## Celestial

Voyara's premium private accommodation.

Celestial accommodations are available only aboard spacecraft that support them.

**Fare multiplier:** 2.5× voyage base fare.

---

# 8. Flights

A **Flight** is a scheduled instance of a Voyage.

For example:

**Voyage**

ORB-07  
Ares  
Mars Flyby  
40 hours

Possible flights:

VY-482 — November 12, 2087 — Odyssey-02  
VY-491 — November 14, 2087 — Odyssey-01  
VY-503 — November 17, 2087 — Odyssey-03

Each flight contains at minimum:

- Flight number
- Voyage
- Departure time
- Expected return time
- Assigned spacecraft
- Flight status
- Accommodation inventory
- Pricing

Flight numbers identify scheduled flights and do not need to encode voyage information.

---

# 9. Flight Status

Supported flight states:

- `SCHEDULED`
- `BOARDING`
- `DEPARTED`
- `IN_FLIGHT`
- `RETURNING`
- `ARRIVED`
- `DELAYED`
- `CANCELLED`

Most future seeded flights will initially be `SCHEDULED`.

---

# 10. Accommodation Inventory

Availability should ultimately be based on individual accommodations rather than a manually maintained `availableSeats` number.

Example for an Odyssey flight:

### Voyager

V01 through V24

### Voyager+

P01 through P16

### Celestial

C01 through C08

Reservations claim specific accommodations.

Availability can therefore be derived from inventory state.

This architecture should eventually support questions such as:

- Are three Voyager accommodations available?
- Can two passengers sit together?
- Are any Celestial cabins available?
- How many Voyager+ accommodations remain?

Concurrency must eventually prevent the same accommodation from being reserved by multiple customers.

---

# 11. Customers and Passengers

A **Customer** is the person responsible for creating or managing a reservation.

A **Passenger** is a person traveling on the flight.

These concepts must remain separate.

A customer may book travel for themselves and additional passengers.

Example:

Customer:

David

Reservation:

VY-482  
Voyager+  
3 passengers

Passengers:

- David
- Passenger 2
- Passenger 3

Passenger identity requirements should remain minimal in V1.

---

# 12. Reservations

A reservation represents a booking on exactly one Voyara flight.

A reservation contains:

- Customer
- Flight
- Travel class
- One or more passengers
- Assigned accommodations
- Total price
- Reservation status
- Creation timestamp

Supported reservation states:

- `HELD`
- `CONFIRMED`
- `CANCELLED`
- `COMPLETED`

`HELD` may eventually support temporary inventory holds during booking.

For example, a hold may expire after ten minutes if the reservation is not confirmed.

The exact hold implementation belongs to backend design rather than this product specification.

---

# 13. Pricing

Initial pricing uses simple class multipliers against a voyage's base fare.

Example:

Ares base fare: $12,500

Voyager:

$12,500 × 1.0 = $12,500

Voyager+:

$12,500 × 1.4 = $17,500

Celestial:

$12,500 × 2.5 = $31,250

Prices are per passenger.

V1 does not require dynamic pricing.

The architecture should not unnecessarily prevent flight-specific pricing from being introduced later.

---

# 14. Booking Flow

The initial booking experience follows:

Discover Voyage  
→ Search Flights  
→ Select Flight  
→ Select Travel Class  
→ Provide Passenger Information  
→ Assign Accommodations  
→ Confirm Reservation

Payment processing is outside V1 scope.

A confirmed reservation is sufficient to complete the initial booking workflow.

---

# 15. Nova

**Name:** Nova  
**Role:** Voyara Flight Concierge

Nova is Voyara's AI-powered conversational interface.

Nova should eventually support text, browser voice, and telephone interactions.

Nova's personality should be:

- Warm
- Knowledgeable
- Calm
- Concise
- Sophisticated
- Helpful without sounding scripted

Nova should sound like an excellent human travel concierge rather than a science-fiction robot.

Example greeting:

> Welcome to Voyara. I'm Nova, your flight concierge. Where would you like to go?

---

# 16. Nova Capabilities

Nova should eventually be capable of helping customers:

- Discover voyages
- Compare experiences
- Search scheduled flights
- Check accommodation availability
- Obtain prices
- Create reservations
- Retrieve existing reservations
- Modify reservations
- Cancel reservations

Nova may reason about customer intent.

For example:

> "I want to see Mars."

Nova can interpret this as interest in the Ares voyage.

> "What's the longest trip under $20,000?"

Nova can determine that it needs to search Voyara's voyage and pricing information.

> "I want to see Saturn sometime next weekend."

Nova can interpret the desired experience, determine an appropriate voyage, resolve the requested date range, and search scheduled flights.

Nova must use Voyara services whenever an answer depends on current business state.

---

# 17. System Boundary

The long-term conceptual architecture is:

```text
                   VOYARA PLATFORM
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
     Customer UI    Operations UI      Nova
                                        |
                               Text / Voice / Phone
```

The customer website, operations interface, and Nova all interact with the same underlying Voyara platform.

Nova must never be given direct responsibility for authoritative business state.

---

# 18. Initial Development Roadmap

## Milestone 0 — Product Definition

Define the Voyara universe and product rules.

This document represents the initial Milestone 0 specification.

## Milestone 1 — Backend Foundation

Design and implement the core backend and PostgreSQL data model.

## Milestone 2 — Voyara Data

Seed voyages, spacecraft families, spacecraft, flights, accommodations, and realistic test data.

## Milestone 3 — Search and Booking

Implement flight discovery, availability, customer, passenger, and reservation workflows.

## Milestone 4 — Nova Text Agent

Integrate an AI agent capable of interacting with Voyara through controlled tools.

## Milestone 5 — Customer Experience

Build the public Voyara website and booking experience.

## Milestone 6 — Operations

Build the Voyara internal operations interface.

## Milestone 7 — Nova Voice

Introduce real-time browser voice interaction.

## Milestone 8 — Live Agent Operations

Expose active conversations, transcripts, tool calls, and resulting business activity in the operations interface.

## Milestone 9 — Telephony

Allow customers to call a real Voyara telephone number and speak with Nova.

## Milestone 10 — Outbound Calling and Hardening

Introduce outbound calls, failure handling, observability, concurrency hardening, security controls, and production-style reliability work.

---

# 19. Scope Philosophy

Voyara should grow only when a new feature creates a meaningful engineering or product problem worth solving.

Avoid adding fictional complexity solely for world-building.

The purpose of Voyara is to build a compelling software platform through which to learn and demonstrate:

- Backend architecture
- Relational data modeling
- API design
- Transactional workflows
- AI agents
- Tool calling
- Real-time systems
- Voice AI
- Telephony
- Modern frontend engineering

The fictional universe exists to make those engineering problems interesting.

---

# 20. Core Rules

1. Every Voyara flight begins and ends at Voyara Earth Gateway.
2. Every reservation is for one complete scheduled flight.
3. Voyages define experiences; flights represent scheduled instances of those experiences.
4. Spacecraft families define capabilities; individual spacecraft operate flights.
5. Customers and passengers are separate concepts.
6. Accommodation availability comes from Voyara's inventory.
7. Nova does not own business state.
8. Nova interprets customer intent; Voyara services determine truth.
9. The Voyara platform must function without Nova.
10. Keep V1 simple and introduce complexity only when it serves a meaningful product or engineering goal.