# Facilitator guide

This is an illustrative product-learning game. Its detection, delay, prevention and
recovery rules are deliberately bounded abstractions, not production product guarantees.

## A short first demonstration

Choose **The Quiet Morning / Standard**. Spend 13 of 15 credits on AF (4),
EDR on **Open Office workstation #2** (3), and XDR (6). Setup is untimed.
AF goes at Reception; XDR goes in the Security Office. Select EDR, then click the
second workstation in the Open Office. Click desks to check their endpoint IDs in the
inspector if needed. The remaining credits stay available during play.

Begin the day. AF flags the perimeter probe and delays the actor. When the protected
office endpoint produces a second evidence type, XDR confirms the incident. Open that
workstation's inspector and isolate the exact device while the actor is there.
Explain the distinction between perimeter protection, endpoint evidence and correlation.
Review the actual events; containment early in the session does not produce a fictional
replay of attacks that never happened.

For an easier first session, Guided gives more budget and slower incident timing.
Use **Close view** to inspect furniture/people and **Overview** to return to the floor.

## Recovery demonstration

Choose **The Lockout / Standard**. Prepare aStor (3), NDR (5), IAG (3)
and AICP (3), for a total of 14 credits. In Operations, select the recovery rule.

Let the incident progress. Server and Finance encryption are separate events; restoring
one room does not contain the actor or protect the other. The helper restores each
from prepared snapshots. IAG can stop the final export, producing the distinct
exfiltration-blocked result. Compare this with actual targeted containment.

For a manual version, omit AICP and inspect each locked room to restore it. Installing
aStor after the incident starts does not create retroactive snapshots. If the actor is
contained while a room remains encrypted, recover the room before celebrating full recovery.

## Availability and budget demonstration

Choose **Under Pressure / Guided**. Prepare HCI (4), ADC (3), SASE (4),
aStor (3), AICP (3), and NDR (5), spending all 22 initial credits. Select recovery automation.

Compare the traffic-surge and host-failure effects with an unprepared run. SASE rejects
the unauthorized remote session but does not make the actor disappear. Continue watching
the alternate route and the ransomware attempt. Recovery restores services; targeted
room restriction or an accurately protected endpoint is still needed for containment.

This loadout prioritizes infrastructure and recovery over early endpoint response.
Income during the incident offers a limited second chance to improve coverage. Letting
the timer expire with an active actor produces a partial/delayed result, even if data
and uptime remain healthy.

## Controls and review

- Drag: orbit. Scroll: zoom. Floor buttons or 1/2: switch floors. H: overview.
- Escape: cancel placement. Space: pause/resume a live incident when no control has focus.
- Sound is optional and muted initially; it uses locally synthesized ambience.
- Click a signal to inspect its location. XDR needs at least two evidence types.
- Restricting an area disrupts uptime; the wrong area costs more than targeted containment.
- Save the JSON session report for the deployment, operational and response record.
- English and Chinese can be switched during selection, setup, play and review.

Discuss what was visible, what was missed, what was merely delayed, and which services
still needed recovery. Avoid presenting a simulated win as proof of real-world security efficacy.
