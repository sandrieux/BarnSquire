# BarnSquire Privacy Policy

_Last updated: July 21, 2026_

BarnSquire is a self-hosted barn-management application. There is no central
BarnSquire service: all data described below is stored on the server instance
operated by you or your barn's administrator (the "operator"), and is only
accessible to members of the barns you belong to on that instance. BarnSquire
itself contains **no advertising, no analytics, and no trackers**, and no data
is sold or shared with third parties for marketing.

## What is collected

### Account information
- Email address, optional display name, and preferred language
- A password, stored only as a salted hash — never in plain text

### Content you enter
- Barn, animal, and location records; feeding, medication, turnout, exercise,
  and appointment schedules; feed stock levels; care-ledger entries; and
  task-completion history (which records which user completed a task and when)
- Photos and documents you choose to attach (animal photos, ledger
  attachments). These are uploaded directly to the operator's file storage via
  short-lived signed URLs. Camera and photo-library access is only used when
  you actively take or pick a picture — nothing is accessed in the background.

### Administrative records
- An audit log of changes (who changed what, and when) kept so barn
  administrators can review activity on their instance

### Mobile app
- **Push notifications (optional):** if you enable them, the app stores a
  device push token on your instance. Notification delivery is routed through
  Expo's push service and Apple/Google's notification services, so the token
  and the notification text (e.g. "3 tasks due, feed running low") transit
  those services.
- **Sign-in tokens** are kept in your device's secure storage (Keychain /
  Keystore).
- **Biometric unlock (Face ID / fingerprint)** happens entirely on your
  device via the operating system; the app only receives a yes/no result and
  never sees or stores biometric data.
- **Offline cache:** recent barn data is cached on the device so the app works
  without a connection; it is cleared on sign-out.

## What is *not* collected

- No location tracking, contacts, or browsing history
- No advertising identifiers, analytics SDKs, or fingerprinting
- No biometric data
- No payment information — BarnSquire has no in-app purchases

## Data retention & deletion

Your data remains on the operator's instance until deleted there. To correct
or delete your account and its data, contact your instance's operator (for a
barn you don't run yourself, that's typically your barn manager or the person
who set up the server). Deleting an animal, entry, or account removes it from
the instance's database; operators are responsible for their own backups.

## Children

BarnSquire is a workplace/hobby management tool and is not directed at
children under 13.

## Changes

Material changes to this policy will be noted in this file with an updated
date at the top.

## Contact

Questions about this policy or an instance's data handling should go to the
operator of that instance. For questions about the BarnSquire software itself,
open an issue on the project repository.
